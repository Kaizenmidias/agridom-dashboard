# Kaizen CRM

CRM interno da Kaizen Midias, com frontend React/Vite e backend Express para rodar em VPS.

## Stack atual

- React + TypeScript + Vite
- Express.js no backend (`server/`)
- MySQL como banco principal
- Autenticacao via JWT local
- Nginx como proxy/reverse proxy

## Desenvolvimento

1. Instale as dependencias do frontend:

```bash
npm install
```

2. Instale as dependencias do backend:

```bash
cd server
npm install
```

3. Configure o ambiente:

```bash
cp .env.example .env
```

Preencha as variaveis `MYSQL_*`, `JWT_SECRET` e as integracoes usadas pela prospeccao.

4. Rode o backend:

```bash
cd server
npm run start
```

5. Rode o frontend em desenvolvimento:

```bash
npm run dev
```

## Build

```bash
npm run build
```

O build final fica em `dist/`.

## Observacao de migracao

A base foi iniciada em uma arquitetura antiga com servicos externos. A camada principal de autenticacao/backend ja foi preparada para MySQL/JWT, mas alguns modulos de prospeccao e clientes legados ainda precisam ser migrados para remover as ultimas chamadas diretas antigas.
