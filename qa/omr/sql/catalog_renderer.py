"""DDL for the latest original catalog, including generated/identity and ACL."""
import re


def quote(value):
    return '"' + value.replace('"', '""') + '"'


def grants(kind, target, acl, roles):
    if acl is None:
        raise ValueError("ACL not supplied; do not infer production grants")
    names = {
        "TABLE": {"a":"INSERT","r":"SELECT","w":"UPDATE","d":"DELETE","D":"TRUNCATE",
                  "x":"REFERENCES","t":"TRIGGER","m":"MAINTAIN"},
        "FUNCTION": {"X":"EXECUTE"},
        "SEQUENCE": {"r":"SELECT","w":"UPDATE","U":"USAGE"},
    }[kind]
    statements = [f"REVOKE ALL ON {kind} {target} FROM PUBLIC," + ",".join(quote(r) for r in roles) + ";"]
    for entry in acl.strip("{}").split(","):
        role, rights = entry.split("=",1)
        rights = rights.split("/",1)[0]
        role = quote(role) if role else "PUBLIC"
        for symbol, option in re.findall(r"([arwdDxtmXU])(\*?)", rights):
            statements.append(f"GRANT {names[symbol]} ON {kind} {target} TO {role}" +
                              (" WITH GRANT OPTION" if option else "") + ";")
    return "\n".join(statements)


def table_ddl(table, sequences, roles):
    schema, name = table["schema"], table["table"]
    target = quote(schema)+"."+quote(name)
    columns = []
    for c in table["columns"]:
        text = quote(c["name"])+" "+c["type"]
        expression = c["default_or_expression"]
        if c["generated"]:
            assert c["generated"] == "s" and not c["identity"]
            text += f" GENERATED ALWAYS AS ({expression}) STORED"
        elif c["identity"]:
            seq = sequences[c["owned_sequence"]]
            seqname = quote(seq["schema"])+"."+quote(seq["name"])
            mode = {"a":"ALWAYS","d":"BY DEFAULT"}[c["identity"]]
            text += (f" GENERATED {mode} AS IDENTITY (SEQUENCE NAME {seqname} "
                     f"START WITH {seq['start']} INCREMENT BY {seq['increment']} "
                     f"MINVALUE {seq['min']} MAXVALUE {seq['max']} CACHE {seq['cache']} "
                     + ("CYCLE" if seq["cycle"] else "NO CYCLE") + ")")
        elif expression is not None:
            text += " DEFAULT "+expression
        if c["not_null"]:
            text += " NOT NULL"
        columns.append(text)
    statements = [f"CREATE TABLE {target} ({','.join(columns)});"]
    for c in table["constraints"]:
        statements.append(f"ALTER TABLE {target} ADD CONSTRAINT {quote(c['name'])} {c['definition']};")
    constraints = {c["name"] for c in table["constraints"]}
    for index in table["indexes"]:
        name_match = re.search(r"INDEX (\w+) ON",index)
        assert name_match
        if name_match[1] not in constraints:
            statements.append(index+";")
    if table["rls"]:
        statements.append(f"ALTER TABLE {target} ENABLE ROW LEVEL SECURITY;")
    if table["force_rls"]:
        statements.append(f"ALTER TABLE {target} FORCE ROW LEVEL SECURITY;")
    statements.append(grants("TABLE",target,table["acl"],roles))
    for policy in table["policies"]:
        text = (f"CREATE POLICY {quote(policy['name'])} ON {target} FOR {policy['command']} TO "
                + ",".join("PUBLIC" if r=="public" else quote(r) for r in policy["roles"]))
        if policy["using"] is not None:
            text += " USING ("+policy["using"]+")"
        if policy["with_check"] is not None:
            text += " WITH CHECK ("+policy["with_check"]+")"
        statements.append(text+";")
    return "\n".join(statements)
