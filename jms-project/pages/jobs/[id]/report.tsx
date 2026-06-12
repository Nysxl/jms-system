import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { Job, Customer, JobImage } from '@/lib/types'

// --- 1. Custom Native Signature Component ---
// No npm packages required. Handles mouse and touch events natively.
const NativeSignaturePad = ({ onSave, onClear }: { onSave: (data: string) => void, onClear: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    // Handle both touch and mouse events
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault() // Prevents scrolling on touch devices
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.closePath()
    setIsDrawing(false)
  }

  const handleSave = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'))
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      onClear()
    }
  }

  return (
    <div className="print:hidden">
      <div className="border border-slate-300 rounded bg-slate-50 overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-24 bg-transparent cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={handleSave} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded transition">Save</button>
        <button onClick={handleClear} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded transition">Clear</button>
      </div>
    </div>
  )
}

// --- 2. Main Page Interfaces ---
interface Task {
  id: string
  name: string
  status: 'pass' | 'fail' | 'na' | 'pending'
}

interface ServiceReport {
  id: string
  created_at: string
  title: string
  description?: string
  work_performed?: string
  parts_used?: string
  internal_notes?: string
  tasks?: Task[]
  tech_signature?: string
  customer_signature?: string
}

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
  website: string
  logo_url: string
}

export default function ServiceReportPage() {
  const router = useRouter()
  const { id, reportId } = router.query as { id: string; reportId: string }

  const [report, setReport] = useState<ServiceReport | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [images, setImages] = useState<JobImage[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEmailing, setIsEmailing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [showImagePicker, setShowImagePicker] = useState(false)

  const [internalNotes, setInternalNotes] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])

  const [savedTechSig, setSavedTechSig] = useState<string | null>(null)
  const [savedCustSig, setSavedCustSig] = useState<string | null>(null)

  useEffect(() => {
    if (id && reportId) loadAll()
  }, [id, reportId])

  const loadAll = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [reportRes, jobRes, companyRes, imagesRes] = await Promise.all([
        supabase.from('service_reports').select('*').eq('id', reportId).single(),
        supabase.from('jobs').select('*').eq('id', id).single(),
        supabase.from('company_settings').select('*').eq('user_id', user?.id).single(),
        supabase.from('job_images').select('*').eq('job_id', id).order('uploaded_at', { ascending: true }),
      ])

      if (reportRes.error) throw reportRes.error
      if (jobRes.error) throw jobRes.error

      if (reportRes.data) {
        setReport(reportRes.data)
        setInternalNotes(reportRes.data.internal_notes || '')
        setTasks(reportRes.data.tasks || [
          { id: '1', name: 'Inspected control panel', status: 'pending' },
          { id: '2', name: 'Tested PLC communications', status: 'pending' },
          { id: '3', name: 'Verified safety interlocks', status: 'pending' }
        ])
        if (reportRes.data.tech_signature) setSavedTechSig(reportRes.data.tech_signature)
        if (reportRes.data.customer_signature) setSavedCustSig(reportRes.data.customer_signature)
      }
      
      if (jobRes.data) {
        setJob(jobRes.data)
        const { data: cust } = await supabase.from('customers').select('*').eq('id', jobRes.data.customer_id).single()
        if (cust) setCustomer(cust)
      }
      
      if (companyRes.data) setCompany(companyRes.data)
      
      if (imagesRes.data) {
        setImages(imagesRes.data)
        setSelectedImages(new Set(imagesRes.data.map((img: JobImage) => img.id)))
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load report data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailReport = async () => {
    if (!customer?.email) return alert('Customer has no email address')
    setIsEmailing(true)
    try {
      const { error } = await supabase.functions.invoke('email-report', {
        body: { jobId: id, reportId, email: customer.email }
      })
      if (error) throw error
      alert('Report sent successfully')
    } catch (err) {
      console.error(err)
      alert('Failed to send email')
    } finally {
      setIsEmailing(false)
    }
  }

  // --- 3. Dynamic CDN Injection for PDF ---
  const downloadDirectPdf = () => {
    setIsDownloading(true)
    const element = document.getElementById('report-document')
    const opt = {
      margin: 15,
      filename: `Report-${reportId.slice(-8).toUpperCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }

    // Check if it's already loaded
    if ((window as any).html2pdf) {
      ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false))
      return
    }

    // Inject script from CDN
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = () => {
      ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false))
    }
    script.onerror = () => {
      alert('Failed to load PDF generator. Try printing to PDF instead.')
      setIsDownloading(false)
    }
    document.body.appendChild(script)
  }

  const toggleImage = (imgId: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev)
      next.has(imgId) ? next.delete(imgId) : next.add(imgId)
      return next
    })
  }

  const updateTaskStatus = (taskId: string, status: Task['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const photosToRender = images.filter(img => selectedImages.has(img.id))

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">Loading report...</div>
  if (error) return <div className="min-h-screen bg-white flex items-center justify-center text-red-400">Error: {error}</div>
  if (!report || !job) return <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">Report not found</div>

  return (
    <>
      {/* Toolbar */}
      <div className="print:hidden bg-slate-900 px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm transition">← Back</button>
        
        <div className="flex flex-wrap items-center gap-4">
          {images.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowImagePicker(p => !p)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1.5 rounded-lg transition">
                🖼️ Photos ({selectedImages.size}/{images.length})
              </button>

              {showImagePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowImagePicker(false)} />
                  <div className="absolute top-10 right-0 bg-slate-800 border border-slate-700 rounded-xl p-4 w-72 shadow-xl z-50">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Include Photos</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {images.map(img => (
                        <label key={img.id} className="flex items-center gap-3 cursor-pointer group" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedImages.has(img.id)} onChange={() => toggleImage(img.id)} className="accent-blue-500" />
                          <img src={img.image_url} alt="thumb" className="w-8 h-8 rounded object-cover border border-slate-600" />
                          <span className="text-slate-300 text-sm group-hover:text-white transition truncate">{img.file_name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                      <button onClick={e => { e.stopPropagation(); setSelectedImages(new Set(images.map(i => i.id))) }} className="flex-1 text-xs text-blue-400 hover:text-blue-300 transition">Select all</button>
                      <button onClick={e => { e.stopPropagation(); setSelectedImages(new Set()) }} className="flex-1 text-xs text-slate-500 hover:text-slate-300 transition">Clear all</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2 border-l border-slate-700 pl-4">
            <button onClick={handleEmailReport} disabled={isEmailing || !customer?.email} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              {isEmailing ? 'Sending...' : '📧 Email'}
            </button>
            <button onClick={downloadDirectPdf} disabled={isDownloading} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              {isDownloading ? 'Generating...' : '⬇️ Download PDF'}
            </button>
            <button onClick={() => window.print()} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">🖨️ Print</button>
          </div>
        </div>
      </div>

      {/* Document Canvas */}
      <div className="bg-slate-100 min-h-screen py-8 print:py-0 print:bg-white">
        <div id="report-document" className="bg-white max-w-3xl mx-auto px-10 py-10 shadow-sm print:shadow-none print:px-8 print:py-8">

          {/* Internal Notes */}
          <div className="print:hidden mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-2">
              🔒 Internal Notes (Hidden on Export)
            </h4>
            <textarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="Add private job notes here. Client won't see this..."
              className="w-full bg-white border border-amber-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:border-amber-400 min-h-[100px]"
            />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-200">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
              ) : (
                <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">Logo</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900">{company?.company_name || 'Company Name'}</h1>
                {company?.owner_name && <p className="text-slate-600 text-sm">{company.owner_name}</p>}
                {company?.licence_number && <p className="text-slate-500 text-xs">Licence: {company.licence_number}</p>}
                {company?.abn && <p className="text-slate-500 text-xs">ABN: {company.abn}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">SERVICE REPORT</h2>
              <p className="text-slate-500 text-sm">Date: {formatDate(report.created_at)}</p>
              <p className="text-slate-500 text-sm">Report #: {report.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* From / Bill To */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">From</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                {company?.address && <p>{company.address}</p>}
                {(company?.city || company?.state) && <p>{[company?.city, company?.state, company?.zip_code].filter(Boolean).join(', ')}</p>}
                {company?.phone && <p>{company.phone}</p>}
                {company?.email && <p>{company.email}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Client</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{customer?.name}</p>
                {customer?.company_name && <p>{customer.company_name}</p>}
                {customer?.address && <p>{customer.address}</p>}
                {(customer?.city || customer?.state) && <p>{[customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(', ')}</p>}
                {customer?.phone && <p>{customer.phone}</p>}
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-slate-50 rounded-lg p-5 mb-6 border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs">Job Title</p><p className="text-slate-800 font-medium">{job.title}</p></div>
              <div><p className="text-slate-500 text-xs">Status</p><p className="text-slate-800 font-medium capitalize">{job.status}</p></div>
              <div><p className="text-slate-500 text-xs">Scheduled Date</p><p className="text-slate-800">{formatDate(job.scheduled_date)}</p></div>
              <div><p className="text-slate-500 text-xs">Priority</p><p className="text-slate-800 capitalize">{job.priority}</p></div>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-4">{report.title}</h3>

          {/* Dynamic Task Checklist */}
          {tasks.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Task Checklist</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {tasks.map((task, idx) => (
                  <div key={task.id} className={`flex items-center justify-between p-3 text-sm ${idx !== tasks.length - 1 ? 'border-b border-slate-200' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <span className="text-slate-700">{task.name}</span>
                    <div className="flex gap-2 print:hidden">
                      <button onClick={() => updateTaskStatus(task.id, 'pass')} className={`px-2 py-1 rounded text-xs font-medium transition ${task.status === 'pass' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>Pass</button>
                      <button onClick={() => updateTaskStatus(task.id, 'fail')} className={`px-2 py-1 rounded text-xs font-medium transition ${task.status === 'fail' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>Fail</button>
                      <button onClick={() => updateTaskStatus(task.id, 'na')} className={`px-2 py-1 rounded text-xs font-medium transition ${task.status === 'na' ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>N/A</button>
                    </div>
                    {/* Print View of Status */}
                    <div className="hidden print:block font-semibold uppercase text-xs">
                      {task.status === 'pass' && <span className="text-green-600">PASS</span>}
                      {task.status === 'fail' && <span className="text-red-600">FAIL</span>}
                      {task.status === 'na' && <span className="text-slate-500">N/A</span>}
                      {task.status === 'pending' && <span className="text-slate-300">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description & Work Performed */}
          {report.description && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.description}</p>
            </div>
          )}

          {report.work_performed && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Work Performed</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.work_performed}</p>
            </div>
          )}

          {report.parts_used && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Parts / Materials Used</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.parts_used}</p>
            </div>
          )}

          {job.total_amount && (
            <div className="flex justify-end mb-8 mt-6">
              <div className="bg-slate-900 text-white rounded-lg px-6 py-3 text-right">
                <p className="text-slate-400 text-xs uppercase tracking-wide">Total Job Amount</p>
                <p className="text-2xl font-bold">${job.total_amount.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Photos */}
          {photosToRender.length > 0 && (
            <div className="mb-8 mt-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Photos</h4>
              <div className="grid grid-cols-3 gap-3">
                {photosToRender.map(img => (
                  <div key={img.id} className="print:break-inside-avoid">
                    <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="border-t-2 border-slate-200 pt-6 mt-8 print:break-inside-avoid">
            <div className="grid grid-cols-2 gap-8">
              
              {/* Tech Signature */}
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-semibold">Technician Signature</p>
                {savedTechSig ? (
                  <div className="mb-2">
                    <img src={savedTechSig} alt="Tech Signature" className="h-24 w-full object-contain border-b border-slate-400" />
                    <button onClick={() => setSavedTechSig(null)} className="print:hidden text-xs text-red-500 mt-2 hover:underline">Clear Signature</button>
                  </div>
                ) : (
                  <NativeSignaturePad 
                    onSave={(data) => setSavedTechSig(data)} 
                    onClear={() => setSavedTechSig(null)} 
                  />
                )}
                {!savedTechSig && <div className="hidden print:block border-b border-slate-400 w-full h-16 mt-8"></div>}
                <p className="text-xs text-slate-500 mt-1">{company?.owner_name || 'Technician'}</p>
              </div>

              {/* Customer Signature */}
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-semibold">Customer Signature</p>
                {savedCustSig ? (
                  <div className="mb-2">
                    <img src={savedCustSig} alt="Customer Signature" className="h-24 w-full object-contain border-b border-slate-400" />
                    <button onClick={() => setSavedCustSig(null)} className="print:hidden text-xs text-red-500 mt-2 hover:underline">Clear Signature</button>
                  </div>
                ) : (
                  <NativeSignaturePad 
                    onSave={(data) => setSavedCustSig(data)} 
                    onClear={() => setSavedCustSig(null)} 
                  />
                )}
                {!savedCustSig && <div className="hidden print:block border-b border-slate-400 w-full h-16 mt-8"></div>}
                <p className="text-xs text-slate-500 mt-1">{customer?.name || 'Customer'}</p>
              </div>

            </div>
            
            <p className="text-center text-slate-400 text-xs mt-8">
              {company?.company_name}
              {company?.phone ? ` · ${company.phone}` : ''}
              {company?.email ? ` · ${company.email}` : ''}
            </p>
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
