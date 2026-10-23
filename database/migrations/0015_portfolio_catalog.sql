SET search_path=vcm,pg_catalog;
-- Stable internal IDs for the existing platform catalog; no external institutional IDs inferred.
INSERT INTO portfolios(id,code,name) VALUES
('portfolio-international','international','Internacionalización'),
('portfolio-alumni','alumni','Alumni'),
('portfolio-continuing-education','continuing-education','Formación Continua'),
('portfolio-technical-assistance','technical-assistance','Asistencia Técnica'),
('portfolio-applied-research','applied-research','Investigación Aplicada'),
('portfolio-innovation','innovation','Innovación/Transferencia'),
('portfolio-diffusion','diffusion','Difusión/Posicionamiento');
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON portfolios FROM vcm_runtime;
