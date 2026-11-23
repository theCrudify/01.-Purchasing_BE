"""Helpers shared by the db-port generators (python3, stdlib only).

Templates under db/tools/src/ are written with BARE PascalCase column names (like the SQL Server
originals): `quote()` double-quotes every PascalCase token outside string literals / comments, so
`d.TotalAmount` becomes `d."TotalAmount"`. Write SQL keywords UPPERCASE and types / functions /
aliases / variables lowercase; anything PascalCase is treated as an identifier.

Trigger blocks (`expand_triggers`) keep the T-SQL shape of the originals — set-based checks over
`inserted` / `deleted` — and become Postgres statement-level AFTER triggers with transition tables:

    -- @trigger trg_name ON table AFTER INSERT, UPDATE, DELETE
    -- @declare
    v_k bigint[];
    -- @body
    IF UPDATE(Status) AND EXISTS (SELECT 1 FROM inserted i ...) THEN THROW 51062, 'message'; END IF;
    EXIT body;                       -- = T-SQL RETURN
    -- @end

  * Postgres allows transition tables only on single-event triggers, so one function per event is
    emitted (name__ins / __upd / __del); in the INSERT variant `deleted` is an empty relation of the
    table's row type (and `inserted` in the DELETE variant).
  * UPDATE(Col) (T-SQL "column in SET list") becomes "the value changed in some row" for UPDATE,
    true for INSERT, false for DELETE.
  * THROW n, 'msg';  ->  RAISE EXCEPTION 'E<n>: msg' USING ERRCODE = 'P0001';
  * Direct recursion is suppressed like SQL Server's RECURSIVE_TRIGGERS OFF: the GUC kpin.trg holds
    the trigger currently running; a firing caused by that same trigger's own statements is skipped,
    indirect chains (A -> B -> A) still run.
  * All trigger functions are SECURITY DEFINER (owner): they see every row (RLS is bypassed for the
    owner, like TRIGGER_NESTLEVEL() > 0 in the original predicates) and may write tables the
    kpin_app / kpin_portal roles cannot.
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.dirname(HERE)
INIT = os.path.join(DB, 'migrations', '0001_init.generated.sql')


def schema():
    """{table: {'cols': {name: type}, 'pk': [cols]}} parsed from the Prisma-generated DDL."""
    txt = open(INIT).read()
    out = {}
    for m in re.finditer(r'CREATE TABLE "(\w+)" \((.*?)\n\);', txt, re.S):
        body = m.group(2)
        cols = {c: t for c, t in re.findall(r'^\s+"(\w+)" ([A-Z]+)', body, re.M)}
        pk = re.search(r'PRIMARY KEY \(([^)]*)\)', body)
        out[m.group(1)] = {'cols': cols, 'pk': [x.strip(' "') for x in pk.group(1).split(',')] if pk else []}
    return out


SCHEMA = schema()

_TOKEN = re.compile(r"""('(?:[^']|'')*')        # string literal
                       |("(?:[^"]|"")*")        # quoted identifier
                       |(--[^\n]*)              # line comment
                       |(/\*.*?\*/)             # block comment
                       |([A-Za-z_][A-Za-z0-9_]*) # word
                    """, re.S | re.X)
_PASCAL = re.compile(r'[A-Z][A-Za-z0-9]*$')


def quote(sql):
    def rep(m):
        w = m.group(5)
        if w and _PASCAL.match(w) and re.search('[a-z]', w):
            return '"%s"' % w
        return m.group(0)
    return _TOKEN.sub(rep, sql)


def throw(sql):
    def rep(m):
        msg = m.group(2).replace('%', '%%')
        return "RAISE EXCEPTION 'E%s: %s' USING ERRCODE = 'P0001';" % (m.group(1), msg)
    return re.sub(r"THROW (\d{5}), '((?:[^']|'')*)';", rep, sql)


_KW = r'(?!WHERE\b|JOIN\b|LEFT\b|ON\b|UNION\b|GROUP\b|ORDER\b|CROSS\b|INNER\b|EXCEPT\b|LIMIT\b)'


def _empty(sql, rel, table):
    """Replace FROM/JOIN <rel> [alias] with an empty relation of the table's row type."""
    def rep(m):
        alias = m.group(3) or rel
        return '%s (SELECT * FROM %s WHERE false) AS %s' % (m.group(1), table, alias)
    return re.sub(r'\b(FROM|JOIN)\s+%s\b(\s+%s([a-z_]\w*))?' % (rel, _KW), rep, sql)


def _update_macro(sql, event, table):
    pk = SCHEMA[table]['pk']
    def rep(m):
        if event == 'INSERT':
            return 'true'
        if event == 'DELETE':
            return 'false'
        on = ' AND '.join('d_.%s = i_.%s' % (p, p) for p in pk)
        return '(EXISTS (SELECT 1 FROM inserted i_ JOIN deleted d_ ON %s WHERE i_.%s IS DISTINCT FROM d_.%s))' % (on, m.group(1), m.group(1))
    return re.sub(r'\bUPDATE\((\w+)\)', rep, sql)


def trigger(name, table, events, declare, body, comment=''):
    """Emit function(s) + trigger(s) for one T-SQL-style AFTER trigger."""
    assert table in SCHEMA, table
    out = []
    for ev in events:
        sfx = {'INSERT': 'ins', 'UPDATE': 'upd', 'DELETE': 'del'}[ev]
        fn = '%s__%s' % (name, sfx)
        b = _update_macro(body, ev, table)
        ref = {'INSERT': 'NEW TABLE AS inserted', 'UPDATE': 'NEW TABLE AS inserted OLD TABLE AS deleted',
               'DELETE': 'OLD TABLE AS deleted'}[ev]
        if ev == 'INSERT':
            b = _empty(b, 'deleted', table)
        if ev == 'DELETE':
            b = _empty(b, 'inserted', table)
        b = throw(b)
        assert len(fn) <= 63, fn
        out.append(f"""CREATE OR REPLACE FUNCTION {fn}() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_prev text := current_setting('kpin.trg', true);
{declare.strip()}
BEGIN
  IF v_prev = '{name}' THEN RETURN NULL; END IF;   -- own statement (no direct recursion)
  PERFORM set_config('kpin.trg', '{name}', true);
  <<body>> BEGIN
{indent(b.strip(), 4)}
  END body;
  PERFORM set_config('kpin.trg', COALESCE(v_prev, ''), true);
  RETURN NULL;
END $fn$;
DROP TRIGGER IF EXISTS {fn} ON {table};
CREATE TRIGGER {fn} AFTER {ev} ON {table} REFERENCING {ref} FOR EACH STATEMENT EXECUTE FUNCTION {fn}();
""")
    head = ('-- ' + comment.strip().replace('\n', '\n-- ') + '\n') if comment.strip() else ''
    return head + '\n'.join(out)


def indent(s, n):
    return '\n'.join((' ' * n + l) if l.strip() else l for l in s.split('\n'))


_BLOCK = re.compile(r'^-- @trigger (\w+) ON (\w+) AFTER ([A-Z, ]+)\n(.*?)^-- @end\n', re.S | re.M)


def expand_triggers(src):
    def rep(m):
        events = [e.strip() for e in m.group(3).split(',')]
        rest = m.group(4)
        # leading comment lines (before -- @declare / -- @body) describe the trigger
        dm = re.search(r'^-- @declare\n(.*?)(?=^-- @body\n)', rest, re.S | re.M)
        bm = re.search(r'^-- @body\n(.*)', rest, re.S | re.M)
        assert bm, m.group(1)
        return trigger(m.group(1), m.group(2), events, dm.group(1) if dm else '', bm.group(1))
    return _BLOCK.sub(rep, src)


def render(src):
    """template text -> final SQL (trigger blocks expanded, THROW translated, identifiers quoted)."""
    return quote(throw(expand_triggers(src)))
