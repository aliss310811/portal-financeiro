# Rascunhos de NFS-e, cobranças avulsas e reajuste

Atualize o portal e a API juntos. As funções anteriores e as abas CLIENTES e COBRANCAS foram preservadas. O consentimento existente enviar_nota_email continua salvo no cadastro e agora também programa a geração de rascunhos.

## 1. Programar notas e gerar rascunhos
Na tabela dos clientes, selecione Sim em “Programar rascunho NFS-e”. A preferência é salva imediatamente na coluna existente enviar_nota_email.

Ao gerar as cobranças mensais, cada cliente selecionado com preferência SIM recebe um rascunho no Drive. Os arquivos individuais ficam em Pasta do cliente / RASCUNHOS_NF. O TXT com todos os rascunhos daquele lançamento fica em Pasta raiz dos clientes / RASCUNHOS_NF_LOTES e pode ser baixado no resultado do lote.

O botão “Baixar lote de rascunhos”, no histórico, reúne as cobranças da competência cujos clientes têm preferência SIM. Inclui cobranças mensais e avulsas vinculadas a esses clientes. Não gera novas cobranças. Se alguma nota falhar, o painel informa a quantidade que falhou.

Cada cobrança também tem “Baixar rascunho .txt”, mesmo para clientes com preferência NAO. Use quando a nota for solicitada posteriormente. Clicar novamente recupera o rascunho salvo da cobrança. A geração individual não muda a preferência permanente.

Os valores usados são os das cobranças, não a mensalidade atual. Falha na geração de um rascunho não desfaz cobrança já criada, e aparece no resultado. Nesse caso, use a geração individual ou o lote da competência para tentar novamente sem relançar pagamentos.

### Emissor Nacional
O guia oficial do Emissor Nacional não documenta importação de TXT de rascunhos. Estes arquivos auxiliam o preenchimento manual. O botão “Abrir Emissor Nacional” leva ao site oficial. Não existe emissão automática, importação garantida, envio automático de nota fiscal ou webservice de emissão nesta versão.

Guia consultado: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/guia-emissorpubliconacionalweb_snnfse-ern-v12.pdf

Complete e confira no emissor os dados fiscais ausentes no cadastro, como endereço, identificação do prestador, data de competência, município, códigos de serviço, retenções e tributação. Para destinatário externo, só WhatsApp e e-mail foram coletados: identificação fiscal e demais dados necessários à nota precisam ser obtidos antes de emitir.

## 2. Cobranças avulsas
Abra a aba Avulsas, escolha competência, informe se é cliente e preencha descrição, valor e vencimento.
- Cliente: selecione um cliente ATIVO. O valor é específico para esse serviço e não altera sua mensalidade. O link fica em BOLETOS no Drive do cliente, como as outras cobranças. Se a preferência de nota for SIM, o rascunho também é gerado.
- Não cliente: informe apenas WhatsApp e e-mail como dados do destinatário. Não há criação de cliente mensal. O e-mail é usado como identificação do destinatário no pedido de pagamento. Nenhum documento fiscal é presumido.
- O Gmail configurado envia o e-mail com serviço, competência, valor, vencimento e link de pagamento.
- O botão WhatsApp abre a mensagem com o link para envio manual. Não há envio automático por WhatsApp.
- Pagamento manual e webhook InfinitePay também atualizam avulsas. Cobranças mensais e avulsas aparecem separadas nas respectivas abas; os indicadores gerais incluem ambas.

A API cria automaticamente COBRANCAS_AVULSAS na mesma planilha universal, com colunas próprias. Não altere seu cabeçalho. As abas anteriores não precisam de novas colunas, migração SQL ou edição manual.

O registro nasce como GERANDO antes de pedir o link e passa a ABERTO após recebê-lo. Falha de geração fica como ERRO_GERACAO. Se houver erro ou perda de conexão, confira o histórico e a InfinitePay antes de gerar uma nova cobrança. O identificador da operação impede duplicação por repetir a mesma requisição; o botão gerar também fica bloqueado após sucesso. “Nova cobrança” inicia outro serviço. Essa proteção não impede cobranças deliberadas em novas operações ou após recarregar a página.

Falha de e-mail não desfaz a cobrança; seu motivo aparece no painel. O histórico da avulsa também registra se houve envio. Credenciais e autorização do Gmail precisam estar configuradas.

## 3. Reajuste
“Reajustar valores” continua com percentual, prévia, confirmação e avisos por e-mail.
- Todos os clientes ATIVOS com valor mensal válido, dos dois vencimentos.
- 200,00 + 8% = 216,00, com arredondamento ao centavo.
- Atualiza o valor mensal para próximas cobranças geradas. Não modifica cobranças existentes nem valores de avulsas.
- Valores alterados desde a prévia são protegidos contra sobrescrita.
- Histórico: Pasta do cliente / REAJUSTES.
- Prévia expira em 15 minutos e é invalidada quando a API reinicia. Repetir o mesmo token válido não reajusta os clientes já concluídos. Uma nova prévia representa outro reajuste; confira resultados parciais antes de iniciar outra.
- Proteção concorrente de reajuste e avulsa vale para uma instância da API; use a configuração atual de uma réplica durante estas operações.

## 4. Configuração e validação
Reutiliza UNIVERSAL_SPREADSHEET_ID, CLIENTS_ROOT_FOLDER_ID, as credenciais Google Drive/Sheets, InfinitePay e Gmail existentes. A conta Google precisa poder criar arquivos/pastas e adicionar a nova aba à planilha. Não é necessário contratar emissor de notas para usar os rascunhos.

Validação nesta atualização:
- 21 testes da API, cobrindo reajuste, consentimento por lote, geração individual com preferência NAO, reuso de rascunho, cobrança extra sem alterar mensalidade, destinatário externo sem cadastro mensal, contatos/valores inválidos, armazenamento e prevenção de repetição.
- Fluxos de botões renderizados em DOM com respostas simuladas da API: login, valores, preferência, seleção, cobranças, downloads, reajuste, pagamento manual, avulsas de cliente e externo, link WhatsApp, navegação, atualizar e sair.
- Checagem TypeScript da página alterada e build do portal.
- Verificação visual em navegador indisponível no ambiente. Não foram feitas chamadas reais à InfinitePay, ao Drive ou ao Gmail.
- Permanecem as pendências gerais já observadas na versão anterior: tipos Cloudflare na checagem TypeScript global e teste legado que exige metadado de prévia ausente no layout original. Não foram alterados para forçar aprovação.
