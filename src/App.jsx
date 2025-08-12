import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const uid = () => Math.random().toString(36).slice(2)
const todayISO = () => new Date().toISOString().slice(0,10)
const BRL = new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' })
const monthKey = (d) => d.slice(0,7)

const EXPENSE_CATS = ['Essenciais','Supérfluos','Objetivos'].map(n=>({id:n.toLowerCase(), name:n}))
const INCOME_CATS  = ['Salário','Outras'].map(n=>({id:n.toLowerCase(), name:n}))

const useLocalStorage = (key, initial) => {
  const [value, setValue] = useState(()=>{ try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):initial }catch{ return initial } })
  useEffect(()=>localStorage.setItem(key, JSON.stringify(value)),[key,value])
  return [value, setValue]
}

function groupByCategory(txs){ const map={}; txs.forEach(t=>{ const k=t.category||'Outros'; map[k]=(map[k]||0)+t.amount }); return Object.entries(map).map(([name,value])=>({name,value})) }
function monthSummary(txs, ym){ const m=txs.filter(t=>monthKey(t.date)===ym); const income=m.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0); const expense=m.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0); return {income,expense,result:income-expense,txs:m} }
function cumulativeSummary(txs, ym){ const f=txs.filter(t=>monthKey(t.date)<=ym); const income=f.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0); const expense=f.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0); return {income,expense,result:income-expense,txs:f} }
function buildMonthlySeries(txs){ const map={}; txs.forEach(t=>{ const k=monthKey(t.date); map[k]=map[k]||{income:0,expense:0,result:0}; if(t.type==='income') map[k].income+=t.amount; else map[k].expense+=t.amount; map[k].result=map[k].income-map[k].expense; }); return Object.keys(map).sort().map(k=>({month:k,...map[k]})) }

export default function App(){
  const [txs, setTxs] = useLocalStorage('finance_app_txs', [])
  const [tab, setTab] = useState('lancamentos')
  const [year, setYear] = useState(()=>String(new Date().getFullYear()))
  const [month, setMonth] = useState(()=>String(new Date().getMonth()+1).padStart(2,'0'))
  const ym = `${year}-${month}`

  const { income, expense, result, txs: monthTxs } = useMemo(()=>monthSummary(txs, ym),[txs, ym])
  const cumulative = useMemo(()=>cumulativeSummary(txs, ym),[txs, ym])
  const monthSeries = useMemo(()=>buildMonthlySeries(txs),[txs])
  const expenseByCatMonth = useMemo(()=>groupByCategory(monthTxs.filter(t=>t.type==='expense')),[monthTxs])
  const yearsAvailable = useMemo(()=>{ const s=new Set(txs.map(t=>t.date.slice(0,4))); s.add(String(new Date().getFullYear())); return Array.from(s).sort() },[txs])

  function addTx(t){ setTxs([t, ...txs].sort((a,b)=>a.date<b.date?1:-1)) }
  function removeTx(id){ setTxs(txs.filter(t=>t.id!==id)) }

  function exportData(){
    const data = { txs }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `enriquecer-dados-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const fileRef = useRef(null)
  function importData(e){
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try{
        const obj = JSON.parse(String(reader.result||'{}'))
        if(Array.isArray(obj.txs)){ setTxs(obj.txs); alert('Dados importados com sucesso!') }
        else alert('Arquivo inválido.')
      }catch{ alert('Arquivo inválido.') }
      fileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <div className="header">
        <div className="wrap" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
          <div className="brand">
            <img src="/icons/icon-192.png" alt="logo" />
            <div className="h1">Enriquecer • Finanças Pessoais</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <select className="input" value={year} onChange={e=>setYear(e.target.value)}>
              {yearsAvailable.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input" value={month} onChange={e=>setMonth(e.target.value)}>
              {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="content">
          <div className="tabs" role="tablist">
            {['lancamentos','dashboard','historico','backup'].map(k=>(
              <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
                {k==='lancamentos'?'Lançamentos':k==='dashboard'?'Resultados':k==='historico'?'Histórico':'Backup'}
              </button>
            ))}
          </div>

          {tab==='lancamentos' and (
            <div className="grid grid-2">
              <div className="card">
                <h3 style={{marginTop:0}}>Lançar Receita</h3>
                <IncomeForm onAdd={addTx} />
              </div>
              <div className="card">
                <h3 style={{marginTop:0}}>Lançar Despesa</h3>
                <ExpenseForm onAdd={addTx} />
              </div>
              <div className="card" style={{gridColumn:'1 / -1'}}>
                <h3 style={{marginTop:0}}>Movimentações do mês ({ym})</h3>
                <table className="table">
                  <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th><th style={{textAlign:'right'}}>Ações</th></tr></thead>
                  <tbody>
                    {monthTxs.length===0 and (<tr><td colSpan="6" style={{textAlign:'center',color:'var(--muted)'}}>Sem lançamentos neste mês.</td></tr>)}
                    {monthTxs.map(t=>(
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td><span className={`badge ${t.type}`}>{t.type==='income'?'Receita':'Despesa'}</span></td>
                        <td>{t.description}</td>
                        <td>{t.category||'-'}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>{BRL.format(t.amount)}</td>
                        <td style={{textAlign:'right'}}><button className="btn danger" onClick={()=>removeTx(t.id)}>Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab==='dashboard' and (
            <div className="grid">
              <div className="grid grid-3">
                <div className="kpi"><div className="label">Receitas (mês)</div><div style={{fontSize:22,fontWeight:800,color:'#22c55e'}}>{BRL.format(income)}</div></div>
                <div className="kpi"><div className="label">Despesas (mês)</div><div style={{fontSize:22,fontWeight:800,color:'#ef4444'}}>{BRL.format(expense)}</div></div>
                <div className="kpi"><div className="label">Resultado (mês)</div><div style={{fontSize:22,fontWeight:800,color: result>=0?'#22c55e':'#ef4444'}}>{BRL.format(result)}</div></div>
              </div>
              <div className="card">
                <h3 style={{marginTop:0}}>Despesas por categoria (mês)</h3>
                <div style={{height:280}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseByCatMonth} dataKey="value" nameKey="name" outerRadius={100} label>
                        {expenseByCatMonth.map((_,i)=><Cell key={i} fill={['#2563eb','#f59e0b','#84cc16'][i%3]} />)}
                      </Pie>
                      <Tooltip formatter={(v)=>BRL.format(v)} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card">
                <h3 style={{marginTop:0}}>Evolução mensal</h3>
                <div style={{height:300}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthSeries}><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v)=>BRL.format(v)}/><Legend/>
                      <Bar dataKey="income" name="Receitas"/><Bar dataKey="expense" name="Despesas"/><Bar dataKey="result" name="Resultado"/></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {tab==='historico' and (
            <div className="card">
              <h3 style={{marginTop:0}}>Todas as movimentações</h3>
              <table className="table">
                <thead><tr><th>Mês</th><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
                <tbody>
                  {txs.length===0 and (<tr><td colSpan="6" style={{textAlign:'center',color:'var(--muted)'}}>Nenhum lançamento ainda.</td></tr>)}
                  {txs.map(t=>(
                    <tr key={t.id}>
                      <td>{monthKey(t.date)}</td>
                      <td>{t.date}</td>
                      <td style={{color:t.type==='income'?'#22c55e':'#ef4444'}}>{t.type==='income'?'Receita':'Despesa'}</td>
                      <td>{t.description}</td>
                      <td>{t.category||'-'}</td>
                      <td style={{textAlign:'right'}}>{BRL.format(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab==='backup' and (
            <div className="card">
              <h3 style={{marginTop:0}}>Backup e Restauração</h3>
              <div className="row">
                <button className="btn" onClick={exportData}>Exportar dados (.json)</button>
                <input type="file" accept="application/json" ref={fileRef} onChange={importData} style={{display:'none'}} />
                <button className="btn ghost" onClick={()=>fileRef.current?.click()}>Importar dados (.json)</button>
              </div>
              <p className="label" style={{marginTop:10}}>Os dados ficam salvos no seu navegador (localStorage).</p>
            </div>
          )}

          <div className="footer">Enriquecer Finanças Pessoais — PWA • Dados locais • Marca #ffca0f</div>
        </div>
      </div>
    </div>
  )
}

function IncomeForm({ onAdd }){
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(INCOME_CATS[0].id)
  function submit(e){ e.preventDefault(); const v=parseFloat(String(amount).replace(',','.')); if(!description.trim()||!isFinite(v)||v<=0) return; const catName = INCOME_CATS.find(c=>c.id===category)?.name || 'Outras'; onAdd({id:uid(), type:'income', date, description:description.trim(), amount:v, category:catName}); setDescription(''); setAmount('') }
  return (
    <form onSubmit={submit} className="grid" style={{gap:8}}>
      <div><label className="label">Data</label><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
      <div><label className="label">Descrição</label><input className="input" placeholder="Salário, bônus..." value={description} onChange={e=>setDescription(e.target.value)} required/></div>
      <div><label className="label">Categoria</label><select className="input" value={category} onChange={e=>setCategory(e.target.value)}>{INCOME_CATS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label">Valor (R$)</label><div className="row"><input className="input" inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/><button className="btn" type="submit">Adicionar</button></div></div>
    </form>
  )
}

function ExpenseForm({ onAdd }){
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATS[0].id)
  function submit(e){ e.preventDefault(); const v=parseFloat(String(amount).replace(',','.')); if(!description.trim()||!isFinite(v)||v<=0||!category) return; const catName = EXPENSE_CATS.find(c=>c.id===category)?.name || 'Essenciais'; onAdd({id:uid(), type:'expense', date, description:description.trim(), amount:v, category:catName}); setDescription(''); setAmount('') }
  return (
    <form onSubmit={submit} className="grid" style={{gap:8}}>
      <div><label className="label">Data</label><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
      <div><label className="label">Descrição</label><input className="input" placeholder="Aluguel, mercado..." value={description} onChange={e=>setDescription(e.target.value)} required/></div>
      <div><label className="label">Categoria</label><select className="input" value={category} onChange={e=>setCategory(e.target.value)}>{EXPENSE_CATS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label">Valor (R$)</label><div className="row"><input className="input" inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/><button className="btn" type="submit">Adicionar</button></div></div>
    </form>
  )
}
