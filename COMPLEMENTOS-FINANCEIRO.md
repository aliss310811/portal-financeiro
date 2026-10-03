# Complementos do portal financeiro

Atualize esta API e o portal juntos. Nenhuma coluna nova ou migração SQL é necessária. As rotas anteriores e os cadastros existentes foram mantidos.

## Rascunho da nota
No histórico, use “Baixar rascunho .txt”. O arquivo usa o valor da cobrança selecionada (não o valor mensal atual), com razão social, documento, e-mail, telefone, competência, descrição e preferência de envio. É salvo em:

Pasta do cliente / RASCUNHOS_NF / RASCUNHO-NF-<cobrança>.txt

Clicar novamente recupera o rascunho já salvo. O rascunho é um auxílio para digitação no emissor, não um leiaute de importação, documento fiscal ou integração webservice. Endereço e dados fiscais que não existem no cadastro atual devem ser conferidos e preenchidos no emissor. A nota deve ser emitida e enviada manualmente; a preferência de envio já existente é preservada.

## Reajuste
Use “Reajustar valores” > informe o percentual > veja a prévia > aplique.
- Todos os clientes ATIVOS, dos dois vencimentos, entram na prévia.
- Valores inválidos são indicados e ignorados; arquivados ficam fora.
- Exemplo: 200,00 + 8% = 216,00. Arredondamento ao centavo.
- O valor mensal é salvo na mesma aba CLIENTES, para as próximas cobranças geradas. Não há agendamento de competência futura e cobranças existentes não são alteradas.
- Antes da gravação, a API verifica se o valor mudou desde a prévia.
- O Gmail existente envia um aviso com percentual, valor anterior e novo valor. Falha de e-mail não desfaz o valor salvo e aparece no resultado por cliente.
- Histórico em Pasta do cliente / REAJUSTES. O arquivo começa como PREPARADO e suas propriedades passam a APLICADO após salvar o valor. Se a atualização do histórico falhar, o resultado inclui aviso.

A prévia expira em 15 minutos e fica em memória na API. Repetir o mesmo token, enquanto válido, não reajusta novamente os clientes já concluídos. Reiniciar a API invalida as prévias. Em resultados parciais, confira os clientes já salvos antes de gerar outra prévia, pois uma nova prévia representa um novo reajuste. A proteção de execução concorrente vale para uma instância da API (configuração atual); não execute múltiplas réplicas durante o reajuste.

## Configuração
Reutiliza as variáveis Google Drive/Sheets e GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (com os fallbacks já existentes). O Gmail precisa estar autorizado para envio. Permissões de Drive precisam permitir criar arquivos e pastas. Não é necessário contratar emissor/API de notas para estes complementos.

## Validação
Execute `npm test` na API. A suíte inclui reajuste, formatos monetários, arredondamento, proteção contra reaplicação, alteração de cadastro após a prévia e conteúdo do rascunho. Testes não enviam mensagens reais.
