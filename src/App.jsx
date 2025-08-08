import React, { useEffect, useMemo, useState } from 'react'
import './styles.css'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const uid = () => Math.random().toString(36).slice(2)
const todayISO = () => new Date().toISOString().slice(0,10)
const BRL = new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' })
const monthKey = (d) => d.slice(0,7)

const defaultCategories = ['Moradia','Alimentação','Transporte','Lazer','Saúde','Educação','Outros'].map(n => ({id:uid(), name:n}))

const PIE_COLORS = ['#2563eb','#16a34a','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#22c55e','#84cc16','#eab308','#f97316']

const useLocalStorage = (key, initial) => {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial } catch { return initial }
  })
  useEffect(()=>localStorage.setItem(key, JSON.stringify(value)),[key,value])
  return [value, setValue]
}

function groupByCategory(txs){ const map = {}; txs.forEach(t=>{ const k = t.category||'Outros'; map[k]=(map[k]||0)+t.amount }); return Object.entries(map).map(([name,value])=>({name,value})) }
function monthSummary(txs, ym){ const m=txs.filter(t=>monthKey(t.date)===ym); const income=m.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0); const expense=m.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0); return {income,expense,result:income-expense,txs:m} }
function cumulativeSummary(txs, ym){ const f=txs.filter(t=>monthKey(t.date)<=ym); const income=f.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0); const expense=f.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0); return {income,expense,result:income-expense,txs:f} }
function buildMonthlySeries(txs){ const map={}; txs.forEach(t=>{ const k=monthKey(t.date); map[k]=map[k]||{income:0,expense:0,result:0}; if(t.type==='income') map[k].income+=t.amount; else map[k].expense+=t.amount; map[k].result=map[k].income-map[k].expense; }); return Object.keys(map).sort().map(k=>({month:k,...map[k]})) }

export default function App(){
  const [txs, setTxs] = useLocalStorage('finance_app_txs', [])
  const [categories, setCategories] = useLocalStorage('finance_app_categories', defaultCategories)
  const [tab, setTab] = useState('lancamentos')

  const [year, setYear] = useState(()=>String(new Date().getFullYear()))
  const [month, setMonth] = useState(()=>String(new Date().getMonth()+1).padStart(2,'0'))
  const ym = `${year}-${month}`

  const { income, expense, result, txs: monthTxs } = useMemo(()=>monthSummary(txs, ym),[txs, ym])
  const cumulative = useMemo(()=>cumulativeSummary(txs, ym),[txs, ym])
  const monthSeries = useMemo(()=>buildMonthlySeries(txs),[txs])
  const expenseByCatMonth = useMemo(()=>groupByCategory(monthTxs.filter(t=>t.type==='expense')),[monthTxs])

  function addTx(t){ setTxs([t, ...txs].sort((a,b)=>a.date<b.date?1:-1)) }
  function removeTx(id){ setTxs(txs.filter(t=>t.id!==id)) }

  const yearsAvailable = useMemo(()=>{ const s=new Set(txs.map(t=>t.date.slice(0,4))); s.add(String(new Date().getFullYear())); return Array.from(s).sort() },[txs])

  return (
    <div style={{minHeight:'100%'}}>
      <div className="header">
        <div className="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
          <div>
            <div style={{fontWeight:700}}>Controle Financeiro PWA</div>
            <div className="small">Lance receitas e despesas, gerencie categorias e visualize resultados.</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <div>
              <div className="label">Ano</div>
              <select value={year} onChange={e=>setYear(e.target.value)}>
                {yearsAvailable.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <div className="label">Mês</div>
              <select value={month} onChange={e=>setMonth(e.target.value)}>
                {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="tabs">
          {['lancamentos','categorias','dashboard','historico'].map(k=>(
            <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
              {k==='lancamentos'?'Lançamentos':k==='categorias'?'Categorias':k==='dashboard'?'Resultados':'Histórico'}
            </button>
          ))}
        </div>

        {tab==='lancamentos' && (
          <div className="grid grid-2">
            <div className="card" style={{padding:16}}>
              <h3>Lançar Receita</h3>
              <IncomeForm onAdd={addTx} />
            </div>
            <div className="card" style={{padding:16}}>
              <h3>Lançar Despesa</h3>
              <ExpenseForm onAdd={addTx} categories={categories} />
            </div>
            <div className="card" style={{padding:16, gridColumn:'1 / -1'}}>
              <h3>Movimentações do mês ({ym})</h3>
              <table className="table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th><th style={{textAlign:'right'}}>Ações</th></tr>
                </thead>
                <tbody>
                  {monthTxs.length===0 && (<tr><td colSpan="6" style={{textAlign:'center'}} className="small">Sem lançamentos neste mês.</td></tr>)}
                  {monthTxs.map(t=>(
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td><span className={`badge ${t.type}`}>{t.type==='income'?'Receita':'Despesa'}</span></td>
                      <td>{t.description}</td>
                      <td>{t.type==='expense'?t.category:'-'}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{BRL.format(t.amount)}</td>
                      <td style={{textAlign:'right'}}><button className="btn btn-danger" onClick={()=>removeTx(t.id)}>Excluir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='categorias' && (
          <div className="card" style={{padding:16}}>
            <h3>Gerenciar categorias de despesas</h3>
            <CategoryManager categories={categories} setCategories={setCategories} />
          </div>
        )}

        {tab==='dashboard' && (
          <div className="grid grid-3">
            <div className="card" style={{padding:16}}>
              <h3>Resultado do mês ({ym})</h3>
              <div className="summary"><span>Receitas</span><span style={{color:'#166534',fontWeight:700}}>{BRL.format(income)}</span></div>
              <div className="summary"><span>Despesas</span><span style={{color:'#991b1b',fontWeight:700}}>{BRL.format(expense)}</span></div>
              <div className="summary" style={{borderTop:'1px solid #eee',paddingTop:8}}><span style={{fontWeight:700}}>Resultado</span><span style={{fontWeight:800,color:result>=0?'#166534':'#991b1b'}}>{BRL.format(result)}</span></div>
            </div>
            <div className="card" style={{padding:16, gridColumn:'span 2'}}>
              <h3>Despesas por categoria (mês)</h3>
              <div style={{height:300}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseByCatMonth} dataKey="value" nameKey="name" outerRadius={100} label>
                      {expenseByCatMonth.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v)=>BRL.format(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{padding:16, gridColumn:'1 / -1'}}>
              <h3>Evolução mensal</h3>
              <div style={{height:360}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthSeries}>
                    <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v)=>BRL.format(v)} /><Legend />
                    <Bar dataKey="income" name="Receitas" /><Bar dataKey="expense" name="Despesas" /><Bar dataKey="result" name="Resultado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{padding:16, gridColumn:'1 / -1'}}>
              <h3>Acumulado até {ym}</h3>
              <div className="grid grid-3">
                <div className="kpi green"><div className="small">Receitas acumuladas</div><div style={{fontSize:24,fontWeight:800}}>{BRL.format(cumulative.income)}</div></div>
                <div className="kpi red"><div className="small">Despesas acumuladas</div><div style={{fontSize:24,fontWeight:800}}>{BRL.format(cumulative.expense)}</div></div>
                <div className="kpi blue"><div className="small">Resultado acumulado</div><div style={{fontSize:24,fontWeight:800}}>{BRL.format(cumulative.result)}</div></div>
              </div>
            </div>
          </div>
        )}

        {tab==='historico' && (
          <div className="card" style={{padding:16}}>
            <h3>Todas as movimentações</h3>
            <table className="table">
              <thead><tr><th>Mês</th><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
              <tbody>
                {txs.length===0 && (<tr><td colSpan="6" className="small" style={{textAlign:'center'}}>Nenhum lançamento ainda. Comece adicionando receitas e despesas.</td></tr>)}
                {txs.map(t=>(
                  <tr key={t.id}>
                    <td>{monthKey(t.date)}</td>
                    <td>{t.date}</td>
                    <td style={{color:t.type==='income'?'#166534':'#991b1b',fontWeight:700}}>{t.type==='income'?'Receita':'Despesa'}</td>
                    <td>{t.description}</td>
                    <td>{t.type==='expense'?t.category:'-'}</td>
                    <td style={{textAlign:'right'}}>{BRL.format(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="small" style={{textAlign:'center',padding:'16px 0'}}>Dados armazenados no seu navegador (localStorage). PWA com cache offline básico.</div>
      </div>
    </div>
  )
}

function IncomeForm({ onAdd }){
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  function submit(e){ e.preventDefault(); const v=parseFloat(amount.replace(',','.')); if(!description.trim()||!isFinite(v)||v<=0) return; onAdd({id:uid(), type:'income', date, description:description.trim(), amount:v}); setDescription(''); setAmount('') }
  return (
    <form onSubmit={submit} className="grid" style={{gap:8}}>
      <div><div className="label">Data</div><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
      <div><div className="label">Descrição</div><input className="input" placeholder="Salário, bônus..." value={description} onChange={e=>setDescription(e.target.value)} required/></div>
      <div><div className="label">Valor (R$)</div><div style={{display:'flex',gap:8}}><input className="input" inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/><button className="btn" type="submit">Adicionar</button></div></div>
    </form>
  )
}

function ExpenseForm({ onAdd, categories }){
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0]?.id || '')
  useEffect(()=>{ if(!categories.find(c=>c.id===category) && categories[0]) setCategory(categories[0].id) },[categories])
  function submit(e){ e.preventDefault(); const v=parseFloat(amount.replace(',','.')); if(!description.trim()||!isFinite(v)||v<=0||!category) return; const catName = categories.find(c=>c.id===category)?.name || 'Outros'; onAdd({id:uid(), type:'expense', date, description:description.trim(), amount:v, category:catName}); setDescription(''); setAmount('') }
  return (
    <form onSubmit={submit} className="grid" style={{gap:8}}>
      <div><div className="label">Data</div><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
      <div><div className="label">Descrição</div><input className="input" placeholder="Supermercado, aluguel..." value={description} onChange={e=>setDescription(e.target.value)} required/></div>
      <div><div className="label">Categoria</div><select className="input" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><div className="label">Valor (R$)</div><div style={{display:'flex',gap:8}}><input className="input" inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/><button className="btn" type="submit">Adicionar</button></div></div>
    </form>
  )
}

function CategoryManager({ categories, setCategories }){
  const [name, setName] = useState('')
  function add(){ const n=name.trim(); if(!n) return; setCategories([...categories, {id:uid(), name:n}]); setName('') }
  function remove(id){ setCategories(categories.filter(c=>c.id!==id)) }
  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'end',marginBottom:12}}>
        <div style={{flex:1}}><div className="label">Nova categoria</div><input className="input" placeholder="Ex.: Pets" value={name} onChange={e=>setName(e.target.value)} /></div>
        <button className="btn" onClick={add}>Adicionar</button>
      </div>
      <table className="table">
        <thead><tr><th>Nome</th><th style={{textAlign:'right'}}>Ações</th></tr></thead>
        <tbody>
          {categories.map(c=>(<tr key={c.id}><td>{c.name}</td><td style={{textAlign:'right'}}><button className="btn btn-danger" onClick={()=>remove(c.id)}>Excluir</button></td></tr>))}
        </tbody>
      </table>
    </div>
  )
}
