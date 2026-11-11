# Instruções do projeto

## Objetivo e uso

Projeto pessoal do usuário para computador. Prioridade: registrar séries e o episódio em que parou, recuperar histórico manualmente, descobrir séries e preservar os dados ao trocar de computador. Explique instruções em português simples.

## Primeira leitura

Leia `README.md` e `docs/CONTINUIDADE.md`. Confira o estado atual do Git antes de editar. O repositório escolhido pelo usuário é `ASCCJR/TV-Time`; não substitua por outro serviço de hospedagem sem necessidade.

## Dados

- Nunca publique `data/`, backups pessoais, banco SQLite, credenciais ou logs.
- Mudanças de esquema/formato precisam preservar os dados existentes e ter migração e teste de restauração.
- Nunca zere o banco real para testes. Use `TV_TIME_DATA_DIR` ou diretórios temporários.
- Não confunda uma cópia local ou um commit de código com sincronização do histórico na nuvem.
- Conserve a distinção entre data de registro (`markedAt`) e data de visualização (`watchedOn`, desconhecida ao reconstruir o histórico).

## Implementação e validação

- Node.js 24+, sem instalação de dependências para rodar. Mantenha a abertura simples no Windows.
- Preserve a atribuição e licença dos dados TVMaze. Não invente avaliações, audiência, tendências ou comentários.
- Só exiba uma série como disponível em um serviço no Brasil se houver uma fonte atual que confirme isso; canal de origem é outra informação.
- Execute `npm run check` e `npm test` após mudanças funcionais. Para interface, confira no navegador com biblioteca de teste separada.
- Atualize o guia de continuidade quando mudar arquitetura, uso ou limitações. Atualize a documentação com resultados verificados, distinguindo de pendências.
