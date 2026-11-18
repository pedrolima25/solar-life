# Colocar o Solar Life na internet (Render + Vercel)

Tempo: uns 30 minutos. Custo: cerca de **US$ 13/mês** no Render (servidor US$ 7 + banco US$ 6). A Vercel é grátis.

Você vai criar 3 contas (pode entrar com a mesma conta do Google ou do GitHub em todas):

| Serviço | Para quê |
|---|---|
| **GitHub** (github.com) | guarda o código do sistema |
| **Render** (render.com) | servidor (API) + banco de dados |
| **Vercel** (vercel.com) | o site que você e os clientes abrem |

---

## 1. Enviar o código para o GitHub

1. Crie a conta em **github.com**.
2. Clique em **New repository**:
   - Nome: `solar-life`
   - Marque **Private**, para o código não ficar público.
   - **Não** marque "Add a README".
   - Clique em **Create repository**.
3. No computador, abra o PowerShell na pasta do sistema e rode, trocando `SEU-USUARIO` pelo seu usuário do GitHub:

   ```powershell
   cd "C:\Users\alessandro\sistema solar"
   git remote add origin https://github.com/SEU-USUARIO/solar-life.git
   git push -u origin main
   ```

   Vai abrir o navegador pedindo para entrar no GitHub. Autorize.

## 2. Servidor e banco no Render

1. Crie a conta em **render.com** e entre com o GitHub.
2. Clique em **New → Blueprint** e escolha o repositório **solar-life**.
3. O Render lê o arquivo `render.yaml` e pede 3 informações:
   - **ADMIN_EMAIL**: o seu e-mail de acesso ao sistema.
   - **ADMIN_PASSWORD**: uma **senha forte** (mínimo 8 caracteres). **Não use admin123.**
   - **CORS_ORIGINS**: `https://solar-life.vercel.app`. Se no passo 3 a Vercel der outro endereço, você corrige aqui depois.
4. Clique em **Apply**. Leva uns 5 minutos.
5. Quando ficar verde, copie o endereço do servidor, algo como `https://solar-life-api.onrender.com`.
   Abra `https://solar-life-api.onrender.com/health` no navegador. Deve aparecer `{"status":"ok"}`.

## 3. Site na Vercel

1. Crie a conta em **vercel.com** e entre com o GitHub.
2. Clique em **Add New → Project** e importe o **solar-life**.
3. Configure:
   - **Project Name**: `solar-life`
   - **Root Directory**: clique em *Edit* e escolha **frontend**.
   - Em **Environment Variables**, adicione:
     - `NEXT_PUBLIC_API_URL` = o endereço do Render do passo 2 (ex.: `https://solar-life-api.onrender.com`)
     - `NEXT_PUBLIC_SITE_URL` = `https://solar-life.vercel.app`
4. Clique em **Deploy**. Leva uns 2 minutos.
5. Confira o endereço que a Vercel mostrou. Se for diferente de `https://solar-life.vercel.app`:
   - no Render, em **solar-life-api → Environment**, corrija o **CORS_ORIGINS** e salve;
   - na Vercel, corrija o **NEXT_PUBLIC_SITE_URL** e faça **Redeploy**.

## 4. Primeiro acesso

1. Abra o endereço da Vercel e entre com o e-mail e a senha que você definiu no Render.
2. Em **Configurações**, confira os dados da empresa, o logo e os preços.
3. Em **Equipe**, cadastre vendedores e técnicos.
4. Em **Materiais / Estoque**, ajuste os preços do catálogo.

> O sistema na internet começa **limpo**: os clientes e orçamentos de teste deste computador não vão junto. Os dados da empresa e o catálogo de produtos já vêm preenchidos.

## Atualizações

Quando eu fizer melhorias no sistema, basta enviar de novo:

```powershell
git add -A
git commit -m "Melhorias"
git push
```

O Render e a Vercel atualizam sozinhos em poucos minutos.

## Segurança já configurada

- Senha do administrador obrigatória, e o servidor não inicia com senha fraca.
- Chave secreta gerada automaticamente pelo Render.
- Login bloqueado por 15 minutos depois de 5 senhas erradas.
- Só o seu site pode acessar a API (CORS).
- Link público do orçamento com código aleatório: mostra só a apresentação, sem CPF, telefone nem preços de custo.
- O banco do Render tem **backup diário automático**.
