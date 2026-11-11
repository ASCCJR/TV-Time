# Continuidade do projeto

## Contexto

O usuário gostava do antigo TV Time e quer um app pessoal para o computador. Está de férias, não tem exportação do histórico antigo e quer reconstruir a lista. Criou `https://github.com/ASCCJR/TV-Time` para preservar e continuar o projeto em outros computadores.

## Decisões em 11/11/2026

- Repositório inicialmente vazio e público; código aqui, histórico privado fora do Git.
- Aplicativo web local, acessível no navegador, iniciado por arquivo no Windows. Não exige conta externa nem chave de API.
- TVMaze escolhido para o catálogo inicial por ter API pública; TMDB continua uma possibilidade futura para traduções, tendências e filmes, mediante credencial adequada.
- SQLite é a fonte de verdade do histórico. JSON é o formato portátil de backup, versão 1, identificado por `app: "tv-time-personal"`.
- O app escuta apenas `127.0.0.1`. Não há autenticação para hospedagem pública.

## Funcionalidades

- Busca real no catálogo e detalhes com temporadas e episódios.
- Biblioteca: assistindo, quero assistir, concluídas, pausadas e abandonei.
- Marcar/desmarcar episódio, temporada ou tudo até um episódio selecionado.
- Botão do próximo episódio na visão geral.
- Notas e anotações pessoais.
- Estatísticas derivadas da biblioteca, sem histórico fictício.
- Coleção editorial, afinidade por gênero e programação global de streaming de hoje.
- Salvamento em SQLite, cópias de segurança por alteração e por dia, exportação e importação com validação e mesclagem.

## Regras de progresso

Episódios futuros não são marcados automaticamente. O horário de estreia, quando disponível, é respeitado; datas sem horário usam America/Fortaleza. O próximo episódio é o primeiro regular já lançado e ainda não marcado. A API inicial usa a ordem de exibição padrão e não inclui especiais.

O status manual da série é independente das marcações. Ao marcar o último episódio de uma série encerrada sem episódios futuros conhecidos, ela vai para concluída; ao desmarcar um episódio de uma concluída, volta para assistindo.

Importar soma registros assistidos. Havendo a mesma série, os metadados pessoais da versão com `updatedAt` mais recente prevalecem; as marcações existentes não são removidas. Para uma restauração exata, feche o servidor, preserve a pasta atual e inicie com uma pasta de dados nova antes de importar. Nunca substitua o banco enquanto o servidor estiver rodando.

## Onde trabalhar

Pasta inicial do usuário: `C:\Users\anton\Projetos\TVTime`.

Para mudar de computador, começar por [RETOMADA_NOVO_COMPUTADOR.md](RETOMADA_NOVO_COMPUTADOR.md). O diretório acima é uma referência do PC antigo, não um caminho obrigatório no próximo.

```powershell
npm run check
npm test
npm start
```

Para um teste manual isolado:

```powershell
$env:PORT = '4320'
$env:TV_TIME_DATA_DIR = Join-Path $PWD 'data\teste-manual'
npm start
```

Abra `http://127.0.0.1:4320`. Ao encerrar, remova essas variáveis da sessão antes de iniciar a versão normal. O inicializador usa porta 4317.

## Limites atuais

Sem sincronização automática de histórico entre computadores: o usuário exporta e importa o JSON. Backups locais não sobrevivem à perda do disco; é necessário guardar uma cópia externa.

Sem ranking de comentários, comunidade, filmes ou notificações de fundo. Sugestões por gênero abrangem a coleção inicial, não todo o catálogo. Algumas sinopses e títulos ficam no idioma original. A programação global não confirma disponibilidade em streamings no Brasil.

## Próximas melhorias possíveis

1. Fonte com traduções em português, filmes e tendências reais (por exemplo, TMDB).
2. Backup externo automático com destino privado escolhido pelo usuário.
3. Calendário dos próximos episódios da biblioteca e notificações, se desejado.
4. Expandir recomendações além da coleção editorial.

O usuário prioriza conseguir usar agora e não perder dados. Evite exigir configurações longas ou introduzir serviços pagos sem necessidade.

## Validação inicial

Em 11/11/2026, `npm run check` e os seis testes de `npm test` passaram no Windows com Node.js 24.20.0. Os testes cobrem progresso em lote, exclusão de episódios futuros, desfazer, importação atômica, mesclagem, cópia antes de remoção, persistência após reabrir o banco, validação e proteção de origem, catálogo offline e horário brasileiro de estreia.

No Edge, com banco isolado em `data/browser-test` e porta 4320, foram conferidos: catálogo real, busca de Dark, adição à biblioteca, recuperação de Severance até T01E03, próximo episódio T01E04, registro do próximo episódio, permanência do progresso após recarregar, nota 9 e anotação em Dark, marcação de seus 26 episódios e mudança automática para concluída, programação do dia e tela de backup. Nenhum erro de console apareceu na leitura realizada durante esse teste.

A exportação e importação foram verificadas pela API nos testes automatizados. A observação do download pelo navegador excedeu o tempo da ferramenta e o arquivo não foi localizado na pasta Downloads padrão; o fluxo de escolher um arquivo e importar pela interface ainda não foi validado de ponta a ponta. Não apresentar essa etapa como manualmente aprovada.

O inicializador PowerShell foi executado com sucesso, iniciou o app na porta 4317 e abriu a página no Edge. A biblioteca definitiva começou vazia. O catálogo retornou 12 sugestões reais. Prévia em `docs/tv-time-preview.jpg`.

## Ajuste visual e acesso ao backup

Em 11/11/2026, o usuário rejeitou a paleta verde. A interface passou a usar fundos neutros em grafite, texto cinza/branco e destaque azul. As cores estão em `public/styles.css`, com variáveis `--accent` e `--accent-ink`; o CSS foi separado em linhas para facilitar a manutenção.

O usuário também não localizou o backup e perguntou se era feito no Codex. Para esclarecer o acesso, **Backup e dados** foi movido para o menu principal e o botão superior ganhou o texto **Backup**. O arquivo é baixado dentro do próprio app, na tela `/#backup`, pelo botão **Baixar meu backup**.

Validação desta alteração: `npm run check` passou; a aparência e o botão superior foram conferidos no Edge com biblioteca de teste separada. A versão normal foi aberta na tela de backup, com biblioteca vazia. As prévias em `docs/tv-time-preview.jpg` e `docs/backup-screen.jpg` foram atualizadas. Nenhuma regra de histórico ou de armazenamento mudou.

## Conversa sobre hospedagem e plugins

O usuário esclareceu que não possui exportação do histórico do serviço antigo; começará a reconstruí-lo manualmente. Quer evitar custos e escolher serviços que o Codex consiga administrar, porque não conhece configuração de sites e bancos.

Foram discutidos GitHub para código, Vercel para hospedagem e Supabase para dados/login. Neon e Firebase também foram identificados como alternativas com plugins. Vercel e Supabase foram sugeridos para instalação/conexão, mas isso não foi confirmado. Nenhum serviço online foi implantado, nenhuma credencial foi acrescentada ao projeto e não houve contratação de plano pago. A recomendação não deve ser tratada como migração já realizada ou autorização para contratar serviços. Conferir disponibilidade, acesso e condições dos planos no momento de retomar.

## Preparação para troca de computador — 11/11/2026

Após consultar o remoto, a cópia local estava limpa e alinhada com `origin/main`, no commit `5b2067f`, antes desta revisão de documentação. Não havia código pendente de envio. O conteúdo ignorado estava em `data/`, incluindo a biblioteca pessoal, cache, backups, logs e dados de testes; nada disso deve entrar no repositório público.

Foi preparado um backup JSON separado dentro de `data/migracao/`, acompanhado de SHA-256. A integridade do banco de origem foi conferida em modo somente leitura. A importação foi validada em outro banco temporário e a persistência verificada após reabri-lo, preservando marcações, notas, status e datas pessoais. Nenhuma restauração foi feita sobre a biblioteca original. Esta validação não substitui a cópia do backup para fora do PC antigo.

O usuário foi informado sobre a diferença entre código público e biblioteca pessoal; não autorizou envio do backup ao Drive até este registro. O destino externo precisa ser confirmado. Se houver novos registros depois da exportação, preparar um backup atualizado. Não registrar no GitHub nomes de séries, anotações, conteúdo do backup ou credenciais.

Verificações desta preparação: `npm run check` e os seis testes passaram novamente no Windows com Node.js 24.20.0. Uma cópia limpa baixada do GitHub iniciou o servidor sem instalar pacotes, em caminho com espaços e com diretório de execução diferente da pasta do projeto. A biblioteca inicial estava vazia, os arquivos da interface responderam e a importação/exportação pela API preservou os dados; a persistência foi conferida após encerrar o servidor. A sintaxe do inicializador PowerShell passou. Não foi simulado um Windows sem Node instalado nem repetido o download/importação pela interface do navegador. O código funcional não mudou nesta preparação.
