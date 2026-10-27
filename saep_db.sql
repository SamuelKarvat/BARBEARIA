-- PostgreSQL: crie o banco "saep_db" no pgAdmin, abra o Query Tool nele e execute este script.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DROP TABLE IF EXISTS agendamentos,servicos,barbeiros,clientes,usuarios CASCADE;
CREATE TABLE usuarios(id SERIAL PRIMARY KEY,nome VARCHAR(80) NOT NULL,login VARCHAR(40) NOT NULL UNIQUE,senha VARCHAR(255) NOT NULL);
CREATE TABLE clientes(id SERIAL PRIMARY KEY,nome VARCHAR(80) NOT NULL,cpf BYTEA NOT NULL,telefone VARCHAR(20));
CREATE TABLE barbeiros(id SERIAL PRIMARY KEY,nome VARCHAR(80) NOT NULL,cpf BYTEA NOT NULL,telefone VARCHAR(20));
CREATE TABLE servicos(id SERIAL PRIMARY KEY,nome VARCHAR(60) NOT NULL,preco NUMERIC(8,2) NOT NULL,barbeiro_id INT NOT NULL REFERENCES barbeiros(id));
CREATE TABLE agendamentos(id SERIAL PRIMARY KEY,cliente_id INT NOT NULL REFERENCES clientes(id),servico_id INT NOT NULL REFERENCES servicos(id),data DATE NOT NULL,hora TIME NOT NULL);
INSERT INTO usuarios(nome,login,senha) VALUES('Administrador','admin','$2b$12$dF864WCc/zBJFDkyY3N7L.pWGFE75Td.Mo5J3AHZd3sKPkAS/yh3u'),('Gerente Paulo','paulo','$2b$12$dF864WCc/zBJFDkyY3N7L.pWGFE75Td.Mo5J3AHZd3sKPkAS/yh3u'),('Recepção Ana','ana','$2b$12$dF864WCc/zBJFDkyY3N7L.pWGFE75Td.Mo5J3AHZd3sKPkAS/yh3u');
INSERT INTO clientes(nome,cpf,telefone) VALUES('João Silva',pgp_sym_encrypt('11111111111','saep_lgpd_key_2026'),'48991110001'),('Maria Souza',pgp_sym_encrypt('22222222222','saep_lgpd_key_2026'),'48991110002'),('Carlos Lima',pgp_sym_encrypt('33333333333','saep_lgpd_key_2026'),'48991110003');
INSERT INTO barbeiros(nome,cpf,telefone) VALUES('Rafael',pgp_sym_encrypt('44444444444','saep_lgpd_key_2026'),'48992220001'),('Bruno',pgp_sym_encrypt('55555555555','saep_lgpd_key_2026'),'48992220002'),('Diego',pgp_sym_encrypt('66666666666','saep_lgpd_key_2026'),'48992220003');
INSERT INTO servicos(nome,preco,barbeiro_id) VALUES('Corte Degradê',45,1),('Barba',30,2),('Corte + Barba',70,3);
INSERT INTO agendamentos(cliente_id,servico_id,data,hora) VALUES(1,1,'2026-11-02','09:00'),(2,2,'2026-11-02','10:00'),(3,3,'2026-11-03','14:30');
