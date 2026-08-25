"use client";

import { useEffect, useMemo, useState } from "react";

type Client = { cliente_id:string; razao_social:string; nome_fantasia:string; cnpj:string; email_principal:string; status:string; valor_mensal:string; dia_vencimento:string };
type Charge = { cobranca_id:string; cliente_id:string; competencia:string; descricao:string; valor:string; data_vencimento:string; link_pagamento:string; status:string; comprovante_url?:string };

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://portal-alisson-api.onrender.com").replace(/\/$/, "");
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

  useEffect(() => { setKey(sessionStorage.getItem("financeiro_key") || ""); }, []);
  useEffect(() => { if (key) loadAll(); }, [key, competence]);

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
        request(`/api/financeiro/cobrancas?competencia=${competence}`).catch(() => ({ cobrancas:[] })),
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
    try {
      await request(`/api/financeiro/clientes/${client.cliente_id}`, { method:"PATCH", body:JSON.stringify({ valor_mensal:client.valor_mensal }) });
      setNotice(`Valor de ${client.nome_fantasia || client.razao_social} salvo.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Valor inválido"); }
  }

  async function generateBatch() {
    setGenerating(true);
    try {
      const data = await request("/api/financeiro/cobrancas/lote", { method:"POST", body:JSON.stringify({ cliente_ids:[...selected], competencia:competence, dia_vencimento:dueDay }) });
      const ok = (data.resultados || []).filter((item:{ok:boolean}) => item.ok).length;
      const failed = (data.resultados || []).length - ok;
      setNotice(`${ok} cobrança(s) do dia ${dueDay} gerada(s)${failed ? ` e ${failed} não gerada(s)` : ""}.`);
      setSelected(new Set());
      await loadAll();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível gerar as cobranças"); }
    finally { setGenerating(false); }
  }

  const filtered = useMemo(() => clients.filter((client) => {
    const text = `${client.cliente_id} ${client.nome_fantasia} ${client.razao_social} ${client.cnpj}`.toLowerCase();
    return client.status === "ATIVO" && Number(client.dia_vencimento) === dueDay && text.includes(search.toLowerCase());
  }), [clients, search, dueDay]);
  const paid = charges.filter((charge) => charge.status === "PAGO");
  const open = charges.filter((charge) => charge.status !== "PAGO");
  const total = charges.reduce((sum, charge) => sum + Number(charge.valor || 0), 0);

  if (!key) return <main className="login-shell"><section className="login-card"><div className="brand-mark">AF</div><p className="eyebrow">ALISSON FINANÇAS</p><h1>Painel financeiro</h1><p className="muted">Acesso exclusivo da equipe de cobranças.</p><form onSubmit={login}><label>Senha de acesso<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" autoFocus /></label><button type="submit">Entrar</button></form></section></main>;

  return <main className="app-shell">
    <aside><div><div className="brand-mark">AF</div><strong>Alisson Finanças</strong><small>Financeiro</small></div><nav><a className="active">Cobranças</a><a href="#clientes">Clientes</a><a href="#historico">Histórico</a></nav><button className="ghost" onClick={logout}>Sair</button></aside>
    <section className="content">
      <header><div><p className="eyebrow">GESTÃO DE RECEBIMENTOS</p><h1>Cobranças mensais</h1><p className="muted">Gere e acompanhe os links enviados ao portal dos clientes.</p></div><button className="secondary" onClick={loadAll} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}</button></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      <div className="metrics"><article><small>COBRANÇAS DO MÊS</small><strong>{charges.length}</strong><span>{competence}</span></article><article><small>EM ABERTO</small><strong>{open.length}</strong><span>Aguardando pagamento</span></article><article><small>PAGAS</small><strong>{paid.length}</strong><span>Confirmadas pela InfinitePay</span></article><article><small>VALOR LANÇADO</small><strong>{money(String(total))}</strong><span>Total da competência</span></article></div>
      <section className="batch-card" id="clientes"><div className="section-title"><div><p className="eyebrow">NOVO LOTE</p><h2>Gerar cobranças</h2></div><span className="selection-count">{selected.size ? `${selected.size} selecionado(s)` : `${filtered.length} cliente(s) no dia ${dueDay}`}</span></div><div className="controls"><label>Competência<input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} /></label><fieldset><legend>Vencimento cadastrado</legend><label className={dueDay === 10 ? "choice checked" : "choice"}><input type="radio" checked={dueDay === 10} onChange={() => {setDueDay(10);setSelected(new Set());}} /> Dia 10</label><label className={dueDay === 28 ? "choice checked" : "choice"}><input type="radio" checked={dueDay === 28} onChange={() => {setDueDay(28);setSelected(new Set());}} /> Dia 28</label></fieldset><button className="primary" onClick={generateBatch} disabled={generating || (!selected.size && !filtered.length)}>{generating ? "Gerando…" : selected.size ? `Gerar ${selected.size} cobrança(s)` : `Gerar todos do dia ${dueDay}`}</button></div>
        <div className="table-tools"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, CNPJ ou código"/><button className="text-button" onClick={() => setSelected(new Set(filtered.map((client) => client.cliente_id)))}>Selecionar visíveis</button><button className="text-button" onClick={() => setSelected(new Set())}>Limpar</button></div>
        <div className="table-wrap"><table><thead><tr><th></th><th>Cliente</th><th>CNPJ</th><th>Valor mensal</th><th></th></tr></thead><tbody>{filtered.map((client) => <tr key={client.cliente_id}><td><input aria-label={`Selecionar ${client.cliente_id}`} type="checkbox" checked={selected.has(client.cliente_id)} onChange={() => toggle(client.cliente_id)} /></td><td><strong>{client.nome_fantasia || client.razao_social}</strong><small>{client.cliente_id}</small></td><td>{client.cnpj || "—"}</td><td><div className="money-input"><span>R$</span><input value={client.valor_mensal || ""} onChange={(event) => setClients((items) => items.map((item) => item.cliente_id === client.cliente_id ? {...item, valor_mensal:event.target.value} : item))} placeholder="0,00" /></div></td><td><button className="save" onClick={() => saveValue(client)}>Salvar</button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty">Nenhum cliente encontrado.</div>}</div>
      </section>
      <section className="history" id="historico"><div className="section-title"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Histórico da competência</h2></div></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Link</th></tr></thead><tbody>{charges.map((charge) => <tr key={charge.cobranca_id}><td><strong>{clients.find((client) => client.cliente_id === charge.cliente_id)?.nome_fantasia || charge.cliente_id}</strong><small>{charge.cliente_id}</small></td><td>{datePt(charge.data_vencimento)}</td><td>{money(charge.valor)}</td><td><span className={`status ${charge.status === "PAGO" ? "paid" : "open"}`}>{charge.status}</span></td><td><a className="link" href={charge.link_pagamento} target="_blank" rel="noreferrer">Abrir cobrança</a></td></tr>)}</tbody></table>{!charges.length && <div className="empty">Nenhuma cobrança gerada para esta competência.</div>}</div></section>
    </section>
  </main>;
}
