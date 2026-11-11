# Retomar no computador novo

O projeto está no repositório [ASCCJR/TV-Time](https://github.com/ASCCJR/TV-Time), na versão principal (`main`). A pasta pode ter outro nome ou ficar em outro lugar no PC novo.

## O que levar

| Item | Onde fica | Precisa copiar do PC antigo? |
| --- | --- | --- |
| Código, interface e instruções | GitHub | Não: baixe o repositório atualizado. |
| Séries adicionadas, episódios marcados, notas e anotações | Banco local, fora do GitHub | Sim, se quiser manter esses registros: leve o backup JSON. |
| Cache do catálogo | Computador antigo | Não: o app consulta o catálogo novamente. |
| Node.js | Instalado no computador | Instale no PC novo, se necessário. |

O backup não depende de ter recuperado o histórico do antigo TV Time. Ele guarda o que você começou a registrar neste aplicativo pessoal. Como o repositório é público, esse arquivo deve ficar em um local privado, como seu pendrive ou uma pasta do seu Drive sem compartilhamento.

## Antes de deixar o PC antigo

Se já adicionou séries:

1. Abra o app e vá a **Backup e dados → Baixar meu backup**.
2. Guarde o arquivo `.json` fora do computador antigo.
3. Se registrar mais episódios depois, baixe um novo backup.

O arquivo deve ser importado como JSON, sem converter para documento ou planilha. Uma cópia somente na pasta `data` ainda está no PC antigo. A cópia do código no GitHub não leva sua biblioteca.

## Abrir no Windows novo

1. Instale **Node.js 24 ou mais recente**, usando o [instalador oficial](https://nodejs.org/). A versão conferida nesta revisão foi a 24.20.0.
2. No [repositório](https://github.com/ASCCJR/TV-Time), use **Code → Download ZIP** e extraia o ZIP. Se for continuar o desenvolvimento com o Codex, ele pode baixar uma cópia usando Git.
3. Na pasta extraída, dê dois cliques em **Iniciar TV Time.cmd**.
4. O navegador abre o app em **http://127.0.0.1:4317**.
5. Caso tenha levado um backup, abra **Backup e dados → Trazer minha biblioteca** e selecione o arquivo `.json`.
6. Confira se suas séries e marcações apareceram. Depois de reiniciar o PC, use novamente **Iniciar TV Time.cmd**.

Não é necessário executar `npm install`, comprar domínio ou criar contas de hospedagem. O endereço funciona enquanto o aplicativo estiver aberto neste computador. Catálogo e imagens precisam de internet; a biblioteca já salva pode ser consultada offline.

Importar um backup soma as marcações às que já existem. Não apaga episódios marcados mais recentemente no destino. Para uma transferência fiel, importe na biblioteca vazia do PC novo. Nunca apague uma biblioteca existente para tentar restaurar outra.

## Mensagem pronta para o Codex

Copie esta mensagem em uma conversa no computador novo:

> Quero retomar meu TV Time pessoal do repositório https://github.com/ASCCJR/TV-Time. Localize ou baixe a versão principal (`main`) sem substituir trabalho existente. Leia AGENTS.md, README.md, docs/CONTINUIDADE.md e docs/RETOMADA_NOVO_COMPUTADOR.md. Confira Node.js 24+, execute as verificações e abra o aplicativo local para mim. Verifique comigo se trouxe um backup antes de restaurar dados; nunca publique a biblioteca no GitHub nem apague dados existentes. Preserve o visual grafite com azul. A publicação online ainda está em discussão: quero uma solução gratuita que você consiga administrar por plugins. Não presuma que Supabase ou Vercel já estejam conectados.

## Instruções técnicas para a próxima sessão

- Descobrir o diretório atual e conferir `git status`, o remoto e eventuais alterações locais antes de atualizar o código.
- O remoto esperado é `https://github.com/ASCCJR/TV-Time.git`. Usar `git pull --ff-only` apenas após conferir a situação local; nunca usar reset para descartar mudanças.
- Em cópia nova, `git clone https://github.com/ASCCJR/TV-Time.git TVTime` baixa o projeto. Não há dependências externas para instalar.
- Executar `npm run check` e `npm test` com Node.js 24+. O lançador `Iniciar TV Time.cmd` abre a versão normal no Windows.
- O banco normal é `data/library.sqlite`. `PORT` e `TV_TIME_DATA_DIR` permitem testes isolados; não usar a biblioteca pessoal para testes.
- Verificar se uma porta 4317 já ocupada pertence a este aplicativo antes de iniciar outra instância.
- Restaurar backup pelo app ou por sua API local, com validação do formato. Conferir séries, episódios, notas e datas após a restauração.
- Não copiar somente o arquivo SQLite de um servidor em execução: alterações podem estar no arquivo WAL. Preferir o JSON exportado.
- Não copiar credenciais do PC antigo para o repositório. Reconectar serviços quando forem necessários e confirmar o acesso real.

## Situação da versão online

Vercel para hospedar o site e Supabase para banco/login foram recomendados, com Neon e Firebase mencionados como alternativas. O usuário quer evitar custos e poder contar com o Codex para configurar os serviços. A escolha e a conexão das contas ainda precisam ser confirmadas; não houve implantação online.

A versão atual usa Node.js com SQLite local, sem login, e aceita acesso apenas por este computador. Publicar na internet exige adaptar armazenamento e autenticação. Não expor o servidor atual nem apresentar uma cópia do código como sincronização automática da biblioteca. Reavaliar os planos gratuitos e as ferramentas disponíveis quando essa etapa for retomada.
