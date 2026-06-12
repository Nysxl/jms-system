import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { Job, Customer } from '@/lib/types'

interface CompanySettings {
  company_name: string
  owner_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  licence_number: string
  abn: string
  bsb: string
  account_number: string
  website: string
  logo_url: string
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  inventory_id: string | null
}

interface JobAttachment {
  id: string
  file_name: string
  file_url: string
  file_type: string
}

interface RenderedPdf {
  attachmentId: string
  fileName: string
  pages: string[]
}

const PAYMENT_TERMS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: 'Custom', days: -1 },
]

export default function InvoicePage() {
  const router = useRouter()
  const { id, gst } = router.query as { id: string; gst: string }

  const [job, setJob] = useState<Job | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [attachments, setAttachments] = useState<JobAttachment[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gstEnabled, setGstEnabled] = useState(false)
  const [paymentTermsDays, setPaymentTermsDays] = useState(14)
  const [customDays, setCustomDays] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set())
  const [showAttachPicker, setShowAttachPicker] = useState(false)

  const [renderedPdfs, setRenderedPdfs] = useState<RenderedPdf[]>([])
  const [renderingPdfs, setRenderingPdfs] = useState(false)
  const [isEmailing, setIsEmailing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (id) loadAll()
  }, [id])

  useEffect(() => {
    setGstEnabled(gst === 'true')
  }, [gst])

  const loadAll = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [jobRes, companyRes, lineRes, attachRes] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id).single(),
        supabase.from('company_settings').select('*').eq('user_id', user?.id).single(),
        supabase.from('job_line_items').select('*').eq('job_id', id).order('created_at', { ascending: true }),
        supabase.from('job_attachments').select('*').eq('job_id', id).order('uploaded_at', { ascending: true }),
      ])

      if (jobRes.error) throw jobRes.error

      if (jobRes.data) {
        setJob(jobRes.data)
        const { data: cust } = await supabase.from('customers').select('*').eq('id', jobRes.data.customer_id).single()
        if (cust) setCustomer(cust)
      }
      if (companyRes.data) setCompany(companyRes.data)
      if (lineRes.data) setLineItems(lineRes.data)
      if (attachRes.data) {
        setAttachments(attachRes.data)
        setSelectedAttachments(new Set(attachRes.data.map((a: JobAttachment) => a.id)))
      }

      const now = new Date()
      setInvoiceNumber(`INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${id.slice(-6).toUpperCase()}`)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'failed to load invoice data')
    } finally {
      setIsLoading(false)
    }
  }

  const renderPdfs = async () => {
    const pdfsToRender = attachments.filter(
      a => a.file_type === 'application/pdf' && selectedAttachments.has(a.id)
    )
    if (pdfsToRender.length === 0) { setRenderedPdfs([]); return }
  
    setRenderingPdfs(true)
    const results: RenderedPdf[] = []
  
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  
      for (const att of pdfsToRender) {
        try {
          const response = await fetch(att.file_url)
          const arrayBuffer = await response.arrayBuffer()
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
          const pdf = await loadingTask.promise
          const pages: string[] = []
  
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            await new Promise(r => setTimeout(r, 0))
            
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')
            if (!ctx) continue
            await page.render({ canvasContext: ctx, viewport }).promise
            pages.push(canvas.toDataURL('image/jpeg', 0.85))
          }
          
          loadingTask.destroy()
  
          if (pages.length > 0) {
            results.push({ attachmentId: att.id, fileName: att.file_name, pages })
          }
        } catch (err) {
          console.error(`failed to render ${att.file_name}:`, err)
        }
      }
    } catch (err) {
      console.error('failed to load pdfjs:', err)
    }
  
    setRenderedPdfs(results)
    setRenderingPdfs(false)
  }

  const downloadDirectPdf = () => {
    setIsDownloading(true)
    const element = document.getElementById('invoice-document')
    const opt = {
      margin: 15,
      filename: `${invoiceNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    if ((window as any).html2pdf) {
      ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = () => {
      ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false))
    }
    script.onerror = () => {
      alert('failed to load pdf generator try printing to pdf instead')
      setIsDownloading(false)
    }
    document.body.appendChild(script)
  }

  const handleEmailInvoice = async () => {
    if (!customer?.email) {
      alert('customer has no email address')
      return
    }
    setIsEmailing(true)
    try {
      const { error } = await supabase.functions.invoke('email-invoice', {
        body: { jobId: id, invoiceNumber, email: customer.email }
      })
      if (error) throw error
      alert('invoice sent successfully')
    } catch (err) {
      console.error(err)
      alert('failed to send email')
    } finally {
      setIsEmailing(false)
    }
  }

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0)
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0
  const total = subtotal + gstAmount

  const effectiveDays = paymentTermsDays === -1 ? (parseInt(customDays) || 0) : paymentTermsDays
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + effectiveDays)

  const toggleAttachment = (attachId: string) => {
    setSelectedAttachments(prev => {
      const next = new Set(prev)
      next.has(attachId) ? next.delete(attachId) : next.add(attachId)
      return next
    })
  }

  const selectedAttachmentsList = attachments.filter(a => selectedAttachments.has(a.id))
  const selectedImages = selectedAttachmentsList.filter(a => a.file_type.startsWith('image/'))
  const selectedPdfs = selectedAttachmentsList.filter(a => a.file_type === 'application/pdf')
  const selectedOther = selectedAttachmentsList.filter(a => !a.file_type.startsWith('image/') && a.file_type !== 'application/pdf')

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">loading invoice...</div>
  )

  if (error) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-red-400">error: {error}</div>
  )

  if (!job) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">job not found</div>
  )

  return (
    <>
      <div className="print:hidden bg-slate-900 px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0" style={{ zIndex: 50 }}>
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm transition">← back</button>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setGstEnabled(g => !g)}
              className={`relative w-9 h-5 rounded-full transition ${gstEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${gstEnabled ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-slate-300 text-sm">gst (10%)</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">terms:</span>
            <select
              value={paymentTermsDays}
              onChange={e => setPaymentTermsDays(parseInt(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
            >
              {PAYMENT_TERMS.map(t => (
                <option key={t.days} value={t.days}>{t.label}</option>
              ))}
            </select>
            {paymentTermsDays === -1 && (
              <input
                type="number"
                min="0"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                placeholder="days"
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-2 py-1 w-20 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          {attachments.length > 0 && (
            <div className="relative" style={{ zIndex: 100 }}>
              <button
                onClick={() => setShowAttachPicker(p => !p)}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                📎 attachments ({selectedAttachments.size}/{attachments.length})
              </button>

              {showAttachPicker && (
                <>
                  <div className="fixed inset-0" style={{ zIndex: 90 }} onClick={() => setShowAttachPicker(false)} />
                  <div className="absolute top-10 right-0 bg-slate-800 border border-slate-700 rounded-xl p-4 w-72 shadow-xl" style={{ zIndex: 110 }}>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">include attachments</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {attachments.map(att => (
                        <label key={att.id} className="flex items-center gap-2 cursor-pointer group" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedAttachments.has(att.id)}
                            onChange={() => toggleAttachment(att.id)}
                            className="accent-blue-500"
                          />
                          <span className="text-slate-300 text-sm group-hover:text-white transition truncate">
                            {att.file_type === 'application/pdf' ? '📄' : att.file_type.startsWith('image/') ? '🖼️' : '📎'} {att.file_name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                      <button onClick={e => { e.stopPropagation(); setSelectedAttachments(new Set(attachments.map(a => a.id))) }} className="flex-1 text-xs text-blue-400 hover:text-blue-300 transition">select all</button>
                      <button onClick={e => { e.stopPropagation(); setSelectedAttachments(new Set()) }} className="flex-1 text-xs text-slate-500 hover:text-slate-300 transition">clear all</button>
                    </div>
                    {selectedPdfs.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); renderPdfs(); setShowAttachPicker(false) }}
                        disabled={renderingPdfs}
                        className="w-full mt-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs py-2 rounded-lg transition"
                      >
                        {renderingPdfs ? 'rendering pdfs...' : '⚙️ render pdfs inline'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2 border-l border-slate-700 pl-4">
            <button 
              onClick={handleEmailInvoice}
              disabled={isEmailing || !customer?.email}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {isEmailing ? 'sending...' : '📧 email'}
            </button>
            <button 
              onClick={downloadDirectPdf} 
              disabled={isDownloading}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {isDownloading ? 'generating...' : '⬇️ download pdf'}
            </button>
            <button onClick={() => window.print()} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">
              🖨️ print
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white min-h-screen">
        <div id="invoice-document" className="max-w-3xl mx-auto px-10 py-10 print:px-8 print:py-8">

          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-200">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="logo" className="h-16 w-auto object-contain" />
              ) : (
                <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">logo</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900">{company?.company_name || 'company name'}</h1>
                {company?.owner_name && <p className="text-slate-600 text-sm">{company.owner_name}</p>}
                {company?.licence_number && <p className="text-slate-500 text-xs">licence: {company.licence_number}</p>}
                {company?.abn && <p className="text-slate-500 text-xs">abn: {company.abn}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">invoice</h2>
              <p className="text-slate-600 font-medium">{invoiceNumber}</p>
              <p className="text-slate-500 text-sm mt-1">date: {formatDate(new Date().toISOString())}</p>
              <p className="text-slate-500 text-sm">due: {formatDate(dueDate.toISOString())}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">from</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{company?.company_name}</p>
                {company?.address && <p>{company.address}</p>}
                {(company?.city || company?.state) && <p>{[company?.city, company?.state, company?.zip_code].filter(Boolean).join(', ')}</p>}
                {company?.phone && <p>{company.phone}</p>}
                {company?.email && <p>{company.email}</p>}
                {company?.website && <p>{company.website}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">bill to</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{customer?.name}</p>
                {customer?.company_name && <p>{customer.company_name}</p>}
                {customer?.address && <p>{customer.address}</p>}
                {(customer?.city || customer?.state) && <p>{[customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(', ')}</p>}
                {customer?.phone && <p>{customer.phone}</p>}
                {customer?.email && <p>{customer.email}</p>}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg px-5 py-4 mb-6 border border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">job</p>
                <p className="text-slate-800 font-medium">{job.title}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">job ref</p>
                <p className="text-slate-800 font-mono text-xs">{job.id.slice(-8).toUpperCase()}</p>
              </div>
              {job.scheduled_date && (
                <div>
                  <p className="text-slate-500 text-xs">service date</p>
                  <p className="text-slate-800">{formatDate(job.scheduled_date)}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs">status</p>
                <p className="text-slate-800 capitalize">{job.status}</p>
              </div>
            </div>
          </div>

          <table className="w-full text-sm mb-6 border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">description</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-16">qty</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-24">unit price</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-24">amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-sm">no line items</td></tr>
              ) : lineItems.map((item, idx) => (
                <tr key={item.id} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-slate-800">{item.description}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-700">${item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">subtotal</span>
                <span className="text-slate-800">${subtotal.toFixed(2)}</span>
              </div>
              {gstEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">gst (10%)</span>
                  <span className="text-slate-800">${gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-300">
                <span className="text-slate-900">total {gstEnabled ? '(inc gst)' : ''}</span>
                <span className="text-slate-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-8 print:break-inside-avoid">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">payment details</h4>
            <p className="text-slate-600 text-sm mb-3">
              payment is due within <strong>{effectiveDays} days</strong> of invoice date ({formatDate(dueDate.toISOString())})
            </p>
            
            <div className="bg-white border border-slate-200 rounded p-3 text-sm">
              <p className="font-semibold text-slate-700 mb-1">bank transfer</p>
              <div className="grid grid-cols-[100px_1fr] gap-1 text-slate-600">
                <span className="text-slate-400">bank:</span>
                <span>{company?.company_name || 'company account'}</span>
                <span className="text-slate-400">bsb:</span>
                <span className="font-mono">{company?.bsb || '000-000'}</span>
                <span className="text-slate-400">account:</span>
                <span className="font-mono">{company?.account_number || '00000000'}</span>
              </div>
            </div>
            
            {company?.email && <p className="text-slate-500 text-xs mt-3">for queries contact: {company.email}</p>}
          </div>

          {selectedImages.length > 0 && (
            <div className="mb-8 mt-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">supporting images</h4>
              <div className="grid grid-cols-2 gap-4">
                {selectedImages.map(att => (
                  <div key={att.id} className="print:break-inside-avoid">
                    <img src={att.file_url} alt={att.file_name} className="w-full rounded-lg border border-slate-200 object-contain" />
                    <p className="text-slate-500 text-xs mt-1 text-center">{att.file_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPdfs.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">supporting documents</h4>

              {renderedPdfs.length === 0 && !renderingPdfs && (
                <div className="print:hidden bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4">
                  <p className="text-yellow-400 text-sm">
                    click <strong>📎 attachments</strong> then <strong>⚙️ render pdfs inline</strong> to embed pdf pages before printing
                  </p>
                </div>
              )}

              {renderingPdfs && (
                <div className="text-center py-8 text-slate-400 text-sm">rendering pdf pages...</div>
              )}

              {renderedPdfs.map(pdf => (
                <div key={pdf.attachmentId} className="mb-6">
                  <p className="text-slate-600 text-sm font-medium mb-2 print:text-slate-800">📄 {pdf.fileName}</p>
                  <div className="space-y-2">
                    {pdf.pages.map((pageData, i) => (
                      <div key={i} className="print:break-inside-avoid">
                        <img src={pageData} alt={`${pdf.fileName} page ${i + 1}`} className="w-full border border-slate-200 rounded" />
                        {pdf.pages.length > 1 && (
                          <p className="text-slate-400 text-xs text-center mt-1">page {i + 1} of {pdf.pages.length}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {selectedPdfs
                .filter(p => !renderedPdfs.find(r => r.attachmentId === p.id))
                .map(att => (
                  <div key={att.id} className="flex items-center gap-2 text-sm text-slate-600 mb-1 print:hidden">
                    <span>📄</span>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="hover:text-blue-600 transition underline">{att.file_name}</a>
                    <span className="text-slate-400 text-xs">(not yet rendered)</span>
                  </div>
                ))
              }
            </div>
          )}

          {selectedOther.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">other attachments</h4>
              <div className="space-y-1">
                {selectedOther.map(att => (
                  <div key={att.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span>📎</span>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="hover:text-blue-600 transition underline print:no-underline print:text-slate-700">
                      {att.file_name}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t-2 border-slate-200 pt-6 text-center print:break-inside-avoid">
            <p className="text-slate-400 text-xs">
              {company?.company_name}
              {company?.abn ? ` · abn: ${company.abn}` : ''}
              {company?.phone ? ` · ${company.phone}` : ''}
              {company?.email ? ` · ${company.email}` : ''}
            </p>
            {gstEnabled && (
              <p className="text-slate-400 text-xs mt-1">this document includes gst please retain for tax purposes</p>
            )}
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
