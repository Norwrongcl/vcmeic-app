import type { PoolClient } from 'pg'
export async function base(c: PoolClient) {
  await c.query(`INSERT INTO vcm.principals(id,kind,name) VALUES ('human','human','Coordinación'),('hermes','service','Hermes');
INSERT INTO vcm.protected_objects(id,kind,confidentiality,owner_id) VALUES ('case-a','case','internal','human'),('case-b','case','internal','human');
INSERT INTO vcm.cases(id,code,name,kind,protected_object_id) VALUES ('a','A','Caso A','initiative','case-a'),('b','B','Caso B','presence','case-b');
INSERT INTO vcm.sources(id,case_id,name,channel,actor_id) VALUES('sa','a','Entrevista','whatsapp','hermes'),('sb','b','Registro','web','human');`)
}
export async function project(c: PoolClient) {
  await base(c)
  await c.query(
    `INSERT INTO vcm.projects(id,name) VALUES('p','Proyecto'),('q','Otro'); INSERT INTO vcm.project_cases(project_id,case_id) VALUES('p','a'),('p','b'); INSERT INTO vcm.budget_items(id,project_id,name,planned_amount) VALUES('bi','p','Producción',1000),('bq','q','Otro',1000);`,
  )
}
