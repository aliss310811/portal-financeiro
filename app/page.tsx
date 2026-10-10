"use client";

import { useEffect, useMemo, useState } from "react";

type Client = { cliente_id:string; razao_social:string; nome_fantasia:string; cnpj:string; email_principal:string; status:string; valor_mensal:string; dia_vencimento:string; enviar_nota_email?:string };
type AdjustmentRow = { cliente_id:string; nome:string; email?:string; anterior?:string; novo?:string; erro?:string; ok?:boolean; email_notificado?:boolean; email_motivo?:string };
type Charge = { cobranca_id:string; cliente_id:string; competencia:string; descricao:string; valor:string; data_vencimento:string; order_nsu:string; link_pagamento:string; status:string; forma_pagamento?:string; comprovante_url?:string; tipo?:string; contato_email?:string; contato_whatsapp?:string; destinatario_nome?:string };

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://portal-alisson-api.onrender.com").replace(/\/$/, "");
type DraftFile = {nome:string; texto:string; competencia?:string};
type BatchResult = {ok:boolean;cliente_id:string;erro?:string;email_notificado?:boolean;email_motivo?:string;rascunho?:DraftFile;rascunho_erro?:string};

const currentCompetence = new Date().toISOString().slice(0, 7);

function money(value:string) {
  const raw = String(value || "0");
  const number = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "R$ 0,00";
}

function datePt(value:string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

export default function Home() {
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [competence, setCompetence] = useState(currentCompetence);
  const [dueDay, setDueDay] = useState<10|28>(10);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualMethods, setManualMethods] = useState<Record<string,string>>({});

  const [tab, setTab] = useState<"mensais"|"avulsas">("mensais");
  const [draftBatch, setDraftBatch] = useState<DraftFile | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [singleResult, setSingleResult] = useState<Charge | null>(null);
  const [isClient, setIsClient] = useState(true);
  const [singleClient, setSingleClient] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleValue, setSingleValue] = useState("");
  const [singleDescription, setSingleDescription] = useState("");
  const [singleDue, setSingleDue] = useState("");
  const [requestId, setRequestId] = useState("");

  function downloadText(data:DraftFile) {
    const url=URL.createObjectURL(new Blob([data.texto],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=data.nome;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function exportDraftBatch() {
    setExtraBusy(true);
    try {
      const data=await request("/api/financeiro/rascunhos/lote",{method:"POST",body:JSON.stringify({competencia:competence})});
      const failed=(data.resultados || []).filter((r:{ok:boolean})=>!r.ok).length;
      if(data.lote) {setDraftBatch(data.lote);downloadText(data.lote);}
      setNotice(`${data.lote ? "Lote salvo e baixado." : "Nenhum rascunho para os clientes com nota programada nesta competência."}${failed ? ` ${failed} rascunho(s) não gerado(s).` : ""}`);
    } catch(error) {setNotice(error instanceof Error ? error.message : "Falha no lote de rascunhos");}
    finally {setExtraBusy(false);}
  }
  function newSingleCharge() {
    setRequestId(crypto.randomUUID());setSingleResult(null);setSingleDescription("");setSingleValue("");
  }
  async function generateSingle(event:React.FormEvent) {
    event.preventDefault();setExtraBusy(true);
    const id=requestId || crypto.randomUUID();setRequestId(id);
    try {
      const data=await request("/api/financeiro/cobrancas/avulsas",{method:"POST",body:JSON.stringify({request_id:id,e_cliente:isClient,cliente_id:singleClient,email:singleEmail,whatsapp:singlePhone,valor:singleValue,descricao:singleDescription,data_vencimento:singleDue,competencia:competence})});
      setSingleResult(data.cobranca);
      setNotice(`Cobrança avulsa registrada. ${data.email_notificado ? "E-mail enviado." : `E-mail não enviado: ${data.email_motivo || "verificar configuração"}.`}${data.rascunho ? " Rascunho salvo no Drive." : ""}${data.rascunho_erro ? ` Falha no rascunho: ${data.rascunho_erro}.` : ""}${data.aviso ? ` Atenção: ${data.aviso}.` : ""}`);
      await loadAll();
    } catch(error) {setNotice(error instanceof Error ? error.message : "Falha na cobrança avulsa");}
    finally {setExtraBusy(false);}
  }
  function whatsappLink(charge:Charge) {
    let digits=(charge.contato_whatsapp || "").replace(/\D/g,"");if(digits.length===10 || digits.length===11) digits="55"+digits;
    return `https://wa.me/${digits}?text=${encodeURIComponent(`Cobrança: ${charge.descricao}. Valor: ${money(charge.valor)}. Vencimento: ${datePt(charge.data_vencimento)}. Link: ${charge.link_pagamento}`)}`;
  }

  const [percent, setPercent] = useState("8");
  const [preview, setPreview] = useState<{token:string; percentual:number; resultados:AdjustmentRow[]} | null>(null);
  const [adjustmentResults, setAdjustmentResults] = useState<AdjustmentRow[]>([]);
  const [extraBusy, setExtraBusy] = useState(false);

  async function previewAdjustment() {
    setExtraBusy(true); setPreview(null); setAdjustmentResults([]);
    try { setPreview(await request("/api/financeiro/reajustes/previa", {method:"POST",body:JSON.stringify({percentual:percent})})); }
    catch(error) { setNotice(error instanceof Error ? error.message : "Falha na prévia"); }
    finally { setExtraBusy(false); }
  }
  async function applyAdjustment() {
    if (!preview || !window.confirm(`Aplicar ${preview.percentual}% aos clientes da prévia e enviar os avisos por e-mail?`)) return;
    setExtraBusy(true);
    try {
      const data=await request("/api/financeiro/reajustes/aplicar", {method:"POST",body:JSON.stringify({token:preview.token})});
      setAdjustmentResults(data.resultados); setPreview(null);
      setNotice("Reajuste concluído. Confira abaixo os valores salvos e os resultados dos e-mails.");
      await loadAll();
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao aplicar reajuste"); }
    finally { setExtraBusy(false); }
  }
  async function downloadDraft(charge:Charge) {
    setExtraBusy(true);
    try {
      const data=await request(`/api/financeiro/cobrancas/${encodeURIComponent(charge.order_nsu)}/rascunho-nota`, {method:"POST",body:"{}"});
      downloadText(data);
      setNotice("Rascunho salvo no Drive do cliente, em RASCUNHOS_NF, e baixado como .txt.");
    } catch(error) { setNotice(error instanceof Error ? error.message : "Falha ao gerar rascunho"); }
    finally { setExtraBusy(false); }
  }

  useEffect(() => { setKey(sessionStorage.getItem("financeiro_key") || ""); }, []);
  useEffect(() => { if (key) loadAll(); }, [key, competence]);
  useEffect(()=>{setBatchResults([]);setDraftBatch(null);setSelected(new Set());setSingleResult(null);setRequestId("");},[competence]);

  async function request(path:string, options:RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers:{ "Content-Type":"application/json", "x-financeiro-key":key, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação");
    return data;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [clientData, chargeData] = await Promise.all([
        request("/api/financeiro/clientes"),
        request(`/api/financeiro/cobrancas?competencia=${competence}`),
      ]);
      setClients(clientData.clientes || []);
      setCharges(chargeData.cobrancas || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro ao carregar dados");
      if (String(error).includes("AUTENTICADO") || String(error).includes("PERMISSAO")) logout();
    } finally { setLoading(false); }
  }

  function login(event:React.FormEvent) {
    event.preventDefault();
    const value = password.trim();
    if (!value) return;
    sessionStorage.setItem("financeiro_key", value);
    setKey(value);
  }

  function logout() { sessionStorage.removeItem("financeiro_key"); setKey(""); setPassword(""); }
  function toggle(id:string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }

  async function saveValue(client:Client) {
    setExtraBusy(true);
    try {
      await request(`/api/financeiro/clientes/${client.cliente_id}`, { method:"PATCH", body:JSON.stringify({ valor_mensal:client.valor_mensal }) });
      setNotice(`Valor de ${client.nome_fantasia || client.razao_social} salvo.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Valor inválido"); }
    finally {setExtraBusy(false);}
  }

  async function changeDueDay(client:Client, day:string) {
    setExtraBusy(true);
    try {
      await request(`/api/financeiro/clientes/${client.cliente_id}`, { method:"PATCH", body:JSON.stringify({ dia_vencimento:day }) });
      setClients((items) => items.map((item) => item.cliente_id === client.cliente_id ? {...item, dia_vencimento:day} : item));
      setSelected((current) => { const next = new Set(current); next.delete(client.cliente_id); return next; });
      setNotice(`${client.nome_fantasia || client.razao_social} passou para o dia ${day}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível alterar o vencimento"); }
    finally {setExtraBusy(false);}
  }

  async function changeInvoiceEmail(client:Client, enabled:boolean) {
    setExtraBusy(true);
    try {
      await request(`/api/financeiro/clientes/${encodeURIComponent(client.cliente_id)}`, { method:"PATCH", body:JSON.stringify({ enviar_nota_email:enabled }) });
      setClients((items) => items.map((item) => item.cliente_id === client.cliente_id ? {...item, enviar_nota_email:enabled ? "SIM" : "NAO"} : item));
      setNotice(`Preferência de rascunho de ${client.nome_fantasia || client.razao_social} salva.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar a preferência"); }
    finally {setExtraBusy(false);}
  }

  async function confirmManual(charge:Charge) {
    const method = manualMethods[charge.order_nsu] || "PIX";
    if (!window.confirm(`Confirmar esta cobrança como paga por ${method.toLowerCase()}?`)) return;
    setExtraBusy(true);
    try {
      await request(`/api/financeiro/cobrancas/${encodeURIComponent(charge.order_nsu)}/pagamento-manual`, { method:"PATCH", body:JSON.stringify({ forma_pagamento:method }) });
      setNotice("Pagamento confirmado manualmente.");
      await loadAll();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível confirmar o pagamento"); }
    finally {setExtraBusy(false);}
  }

  async function generateBatch() {
    setGenerating(true);setBatchResults([]);setDraftBatch(null);
    try {
      const data = await request("/api/financeiro/cobrancas/lote", { method:"POST", body:JSON.stringify({ cliente_ids:selected.size ? [...selected] : eligible.map(client=>client.cliente_id), competencia:competence, dia_vencimento:dueDay }) });
      const ok = (data.resultados || []).filter((item:{ok:boolean}) => item.ok).length;
      const failed = (data.resultados || []).length - ok;
      setBatchResults(data.resultados || []);setDraftBatch(data.lote_rascunhos || null);
      setNotice(`${ok} cobrança(s) do dia ${dueDay} gerada(s)${failed ? ` e ${failed} não gerada(s)` : ""}. ${(data.resultados || []).filter((r:BatchResult)=>r.rascunho).length} rascunho(s) salvo(s).${data.lote_rascunhos_erro ? ` Falha ao salvar o lote: ${data.lote_rascunhos_erro}.` : ""}`);
      setSelected(new Set());
      await loadAll();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível gerar as cobranças"); }
    finally { setGenerating(false); }
  }

  const filtered = useMemo(() => clients.filter((client) => {
    const text = `${client.cliente_id} ${client.nome_fantasia} ${client.razao_social} ${client.cnpj}`.toLowerCase();
    const dia = String(client.dia_vencimento || "").trim();
    return client.status === "ATIVO" && (!dia || Number(dia) === dueDay) && text.includes(search.toLowerCase());
  }), [clients, search, dueDay]);
  const eligible = filtered.filter(client=>Number(client.dia_vencimento)===dueDay);
  const monthlyCharges=charges.filter(charge=>charge.tipo!=="AVULSA");
  const singleCharges=charges.filter(charge=>charge.tipo==="AVULSA");
  const busy=extraBusy || generating || loading;
  const paid = charges.filter((charge) => charge.status === "PAGO");
  const open = charges.filter((charge) => charge.status !== "PAGO");
  const total = charges.reduce((sum, charge) => sum + Number(charge.valor || 0), 0);

  if (!key) return <main className="login-shell"><section className="login-card"><div className="brand-mark">AF</div><p className="eyebrow">ALISSON FINANÇAS</p><h1>Painel financeiro</h1><p className="muted">Acesso exclusivo da equipe de cobranças.</p><form onSubmit={login}><label>Senha de acesso<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" autoFocus /></label><button type="submit">Entrar</button></form></section></main>;

  return <main className="app-shell">
    <aside><div><div className="brand-mark">AF</div><strong>Alisson Finanças</strong><small>Financeiro</small></div><nav><a href="#clientes" className={tab==="mensais" ? "active" : ""} onClick={()=>setTab("mensais")}>Cobranças</a><a href="#avulsas" className={tab==="avulsas" ? "active" : ""} onClick={()=>setTab("avulsas")}>Cobranças avulsas</a><a href="#clientes" onClick={()=>setTab("mensais")}>Clientes</a><a href="#historico" onClick={()=>setTab("mensais")}>Histórico</a><a href="#reajustes" onClick={()=>setTab("mensais")}>Reajustar valores</a><a href="https://sisteminha.walissondasilvapereiraa.workers.dev/calc12354495165491565491999515195195/" target="_blank" rel="noopener noreferrer">Criar Proposta e Contrato</a></nav><a className="mobile-proposal" href="https://alisson-bio.netlify.app/calc12354495165491565491999515195195/" target="_blank" rel="noopener noreferrer">Criar proposta</a><button className="ghost" onClick={logout}>Sair</button></aside>
    <section className="content">
      <header><div><p className="eyebrow">GESTÃO DE RECEBIMENTOS</p><h1>{tab==="mensais" ? "Cobranças mensais" : "Cobranças avulsas"}</h1><p className="muted">Gere e acompanhe os links enviados ao portal dos clientes.</p></div><button className="secondary" onClick={loadAll} disabled={busy}>{loading ? "Atualizando…" : "Atualizar"}</button></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      <div className="metrics"><article><small>COBRANÇAS DO MÊS</small><strong>{charges.length}</strong><span>{competence}</span></article><article><small>EM ABERTO</small><strong>{open.length}</strong><span>Aguardando pagamento</span></article><article><small>PAGAS</small><strong>{paid.length}</strong><span>Pagamentos confirmados</span></article><article><small>VALOR LANÇADO</small><strong>{money(String(total))}</strong><span>Total da competência</span></article></div>
      <div className="financial-tabs" role="tablist" aria-label="Tipo de cobrança"><button role="tab" aria-selected={tab==="mensais"} onClick={()=>setTab("mensais")}>Mensais</button><button role="tab" aria-selected={tab==="avulsas"} onClick={()=>setTab("avulsas")}>Avulsas</button></div>
      {tab==="mensais" && <>
      <section className="batch-card" id="clientes"><div className="section-title"><div><p className="eyebrow">NOVO LOTE</p><h2>Gerar cobranças</h2></div><span className="selection-count">{selected.size ? `${selected.size} selecionado(s)` : `${eligible.length} cliente(s) no dia ${dueDay}`}</span></div><div className="controls"><label>Competência<input type="month" disabled={busy} value={competence} onChange={(event) => setCompetence(event.target.value)} /></label><fieldset><legend>Vencimento cadastrado</legend><label className={dueDay === 10 ? "choice checked" : "choice"}><input type="radio" disabled={busy} checked={dueDay === 10} onChange={() => {setDueDay(10);setSelected(new Set());}} /> Dia 10</label><label className={dueDay === 28 ? "choice checked" : "choice"}><input type="radio" disabled={busy} checked={dueDay === 28} onChange={() => {setDueDay(28);setSelected(new Set());}} /> Dia 28</label></fieldset><button className="primary" onClick={generateBatch} disabled={busy || (!selected.size && !eligible.length)}>{generating ? "Gerando…" : selected.size ? `Gerar ${selected.size} cobrança(s)` : `Gerar ${eligible.length} cobrança(s) do dia ${dueDay}`}</button></div>
        <div className="table-tools"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, CNPJ ou código"/><button className="text-button" disabled={busy} onClick={() => setSelected(new Set(eligible.map((client) => client.cliente_id)))}>Selecionar visíveis</button><button className="text-button" disabled={busy} onClick={() => setSelected(new Set())}>Limpar</button></div>
        <div className="table-wrap"><table><thead><tr><th></th><th>Cliente</th><th>CNPJ</th><th>Valor mensal</th><th>Dia</th><th>Programar rascunho NFS-e</th><th></th></tr></thead><tbody>{filtered.map((client) => <tr key={client.cliente_id}><td><input aria-label={`Selecionar ${client.cliente_id}`} type="checkbox" disabled={busy || !Number(client.dia_vencimento)} checked={selected.has(client.cliente_id)} onChange={() => toggle(client.cliente_id)} /></td><td><strong>{client.nome_fantasia || client.razao_social}</strong><small>{client.cliente_id}</small></td><td>{client.cnpj || "—"}</td><td><div className="money-input"><span>R$</span><input value={client.valor_mensal || ""} onChange={(event) => setClients((items) => items.map((item) => item.cliente_id === client.cliente_id ? {...item, valor_mensal:event.target.value} : item))} placeholder="0,00" /></div></td><td><select disabled={busy} className="day-select" value={client.dia_vencimento || ""} onChange={(event) => changeDueDay(client,event.target.value)}><option value="" disabled>Definir</option><option value="10">Dia 10</option><option value="28">Dia 28</option></select></td><td><select disabled={busy} aria-label={`Programar rascunho para ${client.nome_fantasia || client.razao_social}`} value={client.enviar_nota_email || ""} onChange={(event) => changeInvoiceEmail(client,event.target.value === "SIM")}><option value="" disabled>Definir</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></td><td><button className="save" disabled={busy} onClick={() => saveValue(client)}>Salvar valor</button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty">Nenhum cliente encontrado.</div>}</div>
      </section>
      {!!batchResults.length && <section className="batch-card"><h2>Resultado do lote</h2>{draftBatch && draftBatch.competencia===competence && <button className="secondary" onClick={()=>downloadText(draftBatch)}>Baixar .txt deste lote</button>}<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Cobrança</th><th>E-mail</th><th>Rascunho</th></tr></thead><tbody>{batchResults.map((r,i)=><tr key={`${r.cliente_id}-${i}`}><td>{r.cliente_id}</td><td>{r.ok ? "Gerada" : r.erro}</td><td>{r.ok ? r.email_notificado ? "Enviado" : r.email_motivo || "Não enviado" : "—"}</td><td>{r.rascunho ? "Salvo" : r.rascunho_erro || "Não programado"}</td></tr>)}</tbody></table></div></section>}
      <section className="batch-card" id="reajustes">
        <div className="section-title"><div><p className="eyebrow">ATUALIZAÇÃO DE HONORÁRIOS</p><h2>Reajustar valores dos clientes</h2></div></div>
        <p className="muted">Aplica o percentual a todos os clientes ativos com valor mensal válido, nos dois vencimentos. A próxima cobrança gerada usará o novo valor. Cobranças existentes mantêm o valor original.</p>
        <div className="controls"><label>Reajuste (%)<input type="number" min="0.01" max="100" step="0.01" value={percent} onChange={event=>{setPercent(event.target.value);setPreview(null);}} /></label><button className="secondary" onClick={previewAdjustment} disabled={busy}>{extraBusy ? "Processando…" : "Ver prévia do reajuste"}</button></div>
        {preview && <><p>Prévia de {preview.percentual}%. Os avisos serão enviados ao e-mail principal cadastrado.</p><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>E-mail do aviso</th><th>Valor atual</th><th>Novo valor</th></tr></thead><tbody>{preview.resultados.map(row=><tr key={row.cliente_id}><td>{row.nome}<small>{row.cliente_id}</small></td><td>{row.email || "Sem e-mail cadastrado"}</td><td>{row.anterior ? money(row.anterior) : "—"}</td><td>{row.erro || money(row.novo || "0")}</td></tr>)}</tbody></table></div><button className="primary" onClick={applyAdjustment} disabled={busy || !preview.resultados.some(row=>!row.erro)}>Aplicar reajuste e enviar avisos</button></>}
        {!!adjustmentResults.length && <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Reajuste</th><th>Aviso por e-mail</th></tr></thead><tbody>{adjustmentResults.map(row=><tr key={row.cliente_id}><td>{row.nome}<small>{row.cliente_id}</small></td><td>{row.ok ? `Salvo: ${money(row.novo || "0")}` : row.erro || "Não aplicado"}</td><td>{row.ok ? row.email_notificado ? "Enviado" : `Não enviado: ${row.email_motivo || "verificar configuração"}` : "—"}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="history" id="historico"><div className="section-title"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Histórico da competência</h2></div><div className="draft-actions"><button className="secondary" disabled={busy} onClick={exportDraftBatch}>Baixar lote de rascunhos</button><a className="link" href="https://www.nfse.gov.br/EmissorNacional/" target="_blank" rel="noopener noreferrer">Abrir Emissor Nacional</a></div></div><p className="muted">O .txt organiza os dados para preenchimento manual no emissor. Gere uma nota individual mesmo que a preferência do cliente seja Não.</p><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th><th>Link</th><th>Nota fiscal</th></tr></thead><tbody>{monthlyCharges.map((charge) => <tr key={charge.cobranca_id}><td><strong>{clients.find((client) => client.cliente_id === charge.cliente_id)?.nome_fantasia || charge.cliente_id}</strong><small>{charge.cliente_id}</small></td><td>{datePt(charge.data_vencimento)}</td><td>{money(charge.valor)}</td><td><span className={`status ${charge.status === "PAGO" ? "paid" : "open"}`}>{charge.status}</span>{charge.forma_pagamento && <small>{charge.forma_pagamento}</small>}</td><td>{charge.status === "PAGO" ? <span className="paid-label">Confirmado</span> : <div className="manual-pay"><select disabled={busy} value={manualMethods[charge.order_nsu] || "PIX"} onChange={(event) => setManualMethods((items) => ({...items,[charge.order_nsu]:event.target.value}))}><option value="PIX">Pix</option><option value="DEPOSITO">Depósito</option><option value="TRANSFERENCIA">Transferência</option><option value="DINHEIRO">Dinheiro</option><option value="OUTRO">Outro</option></select><button disabled={busy} onClick={() => confirmManual(charge)}>Marcar pago</button></div>}</td><td><a className="link" href={charge.link_pagamento} target="_blank" rel="noreferrer">Abrir cobrança</a></td><td><button className="save" disabled={busy} onClick={()=>downloadDraft(charge)}>Baixar rascunho .txt</button></td></tr>)}</tbody></table>{!monthlyCharges.length && <div className="empty">Nenhuma cobrança gerada para esta competência.</div>}</div></section>
      </>}
      {tab==="avulsas" && <section className="batch-card" id="avulsas">
        <div className="section-title"><div><p className="eyebrow">SERVIÇO ADICIONAL OU ATENDIMENTO PONTUAL</p><h2>Nova cobrança avulsa</h2></div></div>
        <p className="muted">O valor desta cobrança não altera a mensalidade. O link é enviado por e-mail; o botão WhatsApp abre a mensagem para você enviar.</p>
        <form onSubmit={generateSingle} className="single-form">
          <label>Competência<input type="month" required value={competence} disabled={busy} onChange={e=>{setCompetence(e.target.value);setSingleResult(null);setRequestId("");}} /></label>
          <label>É cliente cadastrado?<select value={isClient ? "SIM" : "NAO"} disabled={busy || !!singleResult} onChange={e=>setIsClient(e.target.value==="SIM")}><option value="SIM">Sim</option><option value="NAO">Não</option></select></label>
          {isClient ? <label className="wide">Cliente<select required value={singleClient} disabled={busy || !!singleResult} onChange={e=>setSingleClient(e.target.value)}><option value="">Selecione o cliente</option>{clients.filter(c=>c.status==="ATIVO").map(c=><option key={c.cliente_id} value={c.cliente_id}>{c.nome_fantasia || c.razao_social} — {c.cliente_id}</option>)}</select></label> : <><label>WhatsApp<input type="tel" required placeholder="DDD + número" value={singlePhone} disabled={busy || !!singleResult} onChange={e=>setSinglePhone(e.target.value)} /></label><label>E-mail<input type="email" required value={singleEmail} disabled={busy || !!singleResult} onChange={e=>setSingleEmail(e.target.value)} /></label></>}
          <label className="wide">Descrição do serviço<input required maxLength={500} value={singleDescription} disabled={busy || !!singleResult} onChange={e=>setSingleDescription(e.target.value)} placeholder="Ex.: serviço adicional de regularização" /></label>
          <label>Valor (R$)<input required inputMode="decimal" value={singleValue} disabled={busy || !!singleResult} onChange={e=>setSingleValue(e.target.value)} placeholder="0,00" /></label>
          <label>Vencimento<input type="date" required value={singleDue} disabled={busy || !!singleResult} onChange={e=>setSingleDue(e.target.value)} /></label>
          <div className="wide draft-actions"><button className="primary" type="submit" disabled={busy || !!singleResult}>{extraBusy ? "Gerando…" : "Gerar cobrança e enviar e-mail"}</button><button type="button" className="secondary" disabled={busy} onClick={newSingleCharge}>Nova cobrança</button></div>
        </form>
        {singleResult && <div className="notice"><span>Cobrança criada: {money(singleResult.valor)}</span><a className="link" href={singleResult.link_pagamento} target="_blank" rel="noopener noreferrer">Abrir link de pagamento</a></div>}
        <h2>Avulsas da competência</h2><div className="table-wrap"><table><thead><tr><th>Destinatário / serviço</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th><th>Link / contato</th><th>Rascunho</th></tr></thead><tbody>{singleCharges.map(charge=><tr key={charge.cobranca_id}><td><strong>{charge.destinatario_nome || charge.cliente_id}</strong><small>{charge.descricao}</small><small>{charge.contato_email}</small></td><td>{datePt(charge.data_vencimento)}</td><td>{money(charge.valor)}</td><td>{charge.status}</td><td>{charge.status==="PAGO" ? "Confirmado" : charge.link_pagamento ? <div className="manual-pay"><select aria-label="Forma de pagamento" disabled={busy} value={manualMethods[charge.order_nsu] || "PIX"} onChange={e=>setManualMethods(items=>({...items,[charge.order_nsu]:e.target.value}))}>{["PIX","DEPOSITO","TRANSFERENCIA","DINHEIRO","OUTRO"].map(method=><option key={method}>{method}</option>)}</select><button disabled={busy} onClick={()=>confirmManual(charge)}>Marcar pago</button></div> : "Sem link gerado"}</td><td>{charge.link_pagamento && <><a className="link" href={charge.link_pagamento} target="_blank" rel="noopener noreferrer">Abrir cobrança</a>{charge.contato_whatsapp && <a className="whatsapp-link" href={whatsappLink(charge)} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>}</>}</td><td>{charge.link_pagamento && <button className="save" disabled={busy} onClick={()=>downloadDraft(charge)}>Baixar rascunho .txt</button>}</td></tr>)}</tbody></table>{!singleCharges.length && <div className="empty">Nenhuma cobrança avulsa nesta competência.</div>}</div>
      </section>}
    </section>
  </main>;
}
