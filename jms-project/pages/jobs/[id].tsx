import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Job, Customer, JobNote, JobImage, ServiceReport } from '@/lib/types';

interface JobAttachment {
  id: string;
  job_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface LineItem {
  id: string;
  job_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  inventory_id: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  unit_price: number | null;
  unit_cost: number | null;
  sku: string | null;
}

const statusColors: Record<string, string> = {
  requested: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  'in-progress': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  completed: 'bg-green-500/10 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/30',
};

const priorityColors: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const fileIcon = (type: string) => {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  if (type.includes('zip') || type.includes('compressed')) return '🗜️';
  return '📎';
};

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contractor, setContractor] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [attachmentSearch, setAttachmentSearch] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({ scheduled_date: '', duration_hours: '', notes: '' });
  const [savingVisit, setSavingVisit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [newNoteTimestamp, setNewNoteTimestamp] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteTimestamp, setEditingNoteTimestamp] = useState<string | null>(null); // note id being edited
  const [editingNoteTs, setEditingNoteTs] = useState('');

  // Photos
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoTimestamp, setPhotoTimestamp] = useState('');
  const [editingImageTimestamp, setEditingImageTimestamp] = useState<string | null>(null);
  const [editingImageTs, setEditingImageTs] = useState('');

  // Attachments
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<JobAttachment | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  // Expenses
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', expense_type: 'materials', amount: '' });
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Time Tracking
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeForm, setTimeForm] = useState({ date_worked: new Date().toISOString().split('T')[0], hours: '', description: '' });
  const [savingTime, setSavingTime] = useState(false);
  const [timeError, setTimeError] = useState('');

  // Line items
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [lineItemMode, setLineItemMode] = useState<'inventory' | 'writein'>('inventory');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [writeInDesc, setWriteInDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');
  const [linePriceIsOverride, setLinePriceIsOverride] = useState(false);
  const [savingLineItem, setSavingLineItem] = useState(false);
  const [lineItemError, setLineItemError] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  // Service report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ServiceReport | null>(null);
  const [reportForm, setReportForm] = useState({
    title: '', description: '', work_performed: '', parts_used: '', labor_hours: '', labor_rate: '',
  });
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  // Report forms and tasks
  const [reportForms, setReportForms] = useState<Record<string, boolean>>({
    'safety-checklist': false,
    'equipment-inspection': false,
    'quality-assurance': false,
    'customer-signoff': false,
    'work-completion': false,
  });
  const [reportTasks, setReportTasks] = useState<Array<{ id: string; description: string; completed: boolean }>>([]);
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([loadJob(), loadNotes(), loadImages(), loadReports(), loadAttachments(), loadLineItems(), loadInventory(), loadExpenses(), loadTimeEntries(), loadInvoices(), loadVisits()]);
    setIsLoading(false);
  };

  const loadJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) {
      setJob(data);
      const { data: cust } = await supabase.from('customers').select('*').eq('id', data.customer_id).single();
      if (cust) {
        setCustomer(cust);
        // Use explicit billing_customer_id if set, otherwise fall back to contractor_id for sub_contacts
        const billingId = data.billing_customer_id || (cust.customer_type === 'sub_contact' ? cust.contractor_id : null);
        if (billingId && billingId !== data.customer_id) {
          const { data: cont } = await supabase.from('customers').select('*').eq('id', billingId).single();
          if (cont) setContractor(cont);
        }
      }
    }
  };

  const loadInvoices = async () => {
    const { data } = await supabase.from('invoices').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (data) setInvoices(data);
  };

  const loadVisits = async () => {
    const { data } = await supabase.from('job_visits').select('*').eq('job_id', id).order('scheduled_date', { ascending: true });
    if (data) setVisits(data);
  };

  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.scheduled_date) return;
    setSavingVisit(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('job_visits').insert({
      job_id: id,
      user_id: user!.id,
      scheduled_date: visitForm.scheduled_date,
      duration_hours: visitForm.duration_hours ? parseFloat(visitForm.duration_hours) : null,
      notes: visitForm.notes || null,
      status: 'scheduled',
    }).select().single();
    if (!error && data) {
      setVisits([...visits, data]);
      setVisitForm({ scheduled_date: '', duration_hours: '', notes: '' });
      setShowVisitModal(false);
    }
    setSavingVisit(false);
  };

  const updateVisitStatus = async (visitId: string, status: string) => {
    await supabase.from('job_visits').update({ status, updated_at: new Date().toISOString() }).eq('id', visitId);
    setVisits(visits.map(v => v.id === visitId ? { ...v, status } : v));
  };

  const loadNotes = async () => {
    const { data } = await supabase.from('job_notes').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const loadImages = async () => {
    const { data } = await supabase.from('job_images').select('*').eq('job_id', id).order('uploaded_at', { ascending: false });
    if (data) setImages(data);
  };

  const loadReports = async () => {
    const { data } = await supabase.from('service_reports').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const loadAttachments = async () => {
    const { data } = await supabase.from('job_attachments').select('*').eq('job_id', id).order('uploaded_at', { ascending: false });
    if (data) setAttachments(data);
  };

  const loadLineItems = async () => {
    const { data } = await supabase.from('job_line_items').select('*').eq('job_id', id).order('created_at', { ascending: true });
    if (data) setLineItems(data);
  };

  const loadInventory = async () => {
    const { data } = await supabase.from('inventory').select('id, name, unit_price, unit_cost, sku').order('name', { ascending: true });
    if (data) setInventoryItems(data);
  };

  const loadExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (data) setExpenses(data);
  };

  const loadTimeEntries = async () => {
    const { data } = await supabase.from('time_entries').select('*').eq('job_id', id).order('date_worked', { ascending: false });
    if (data) setTimeEntries(data);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    if (!expenseForm.description.trim() || !expenseForm.amount) {
      setExpenseError('Description and amount are required.');
      return;
    }
    setSavingExpense(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('expenses').insert([{
      user_id: user?.id,
      job_id: id,
      description: expenseForm.description,
      expense_type: expenseForm.expense_type,
      amount: parseFloat(expenseForm.amount),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    if (error) { setExpenseError(error.message); setSavingExpense(false); return; }
    setSavingExpense(false);
    setShowExpenseModal(false);
    setExpenseForm({ description: '', expense_type: 'materials', amount: '' });
    loadExpenses();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await supabase.from('expenses').delete().eq('id', expenseId);
    loadExpenses();
  };

  const handleSaveTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeError('');
    if (!timeForm.hours || parseFloat(timeForm.hours) <= 0) {
      setTimeError('Hours must be greater than 0.');
      return;
    }
    setSavingTime(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('time_entries').insert([{
      user_id: user?.id,
      job_id: id,
      description: timeForm.description,
      hours: parseFloat(timeForm.hours),
      date_worked: timeForm.date_worked,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    if (error) { setTimeError(error.message); setSavingTime(false); return; }
    setSavingTime(false);
    setShowTimeModal(false);
    setTimeForm({ date_worked: new Date().toISOString().split('T')[0], hours: '', description: '' });
    loadTimeEntries();
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    await supabase.from('time_entries').delete().eq('id', entryId);
    loadTimeEntries();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    await supabase.from('job_notes').insert([{
      job_id: id, user_id: user?.id, content: newNote.trim(),
      display_timestamp: newNoteTimestamp ? new Date(newNoteTimestamp).toISOString() : null,
      author_type: 'admin',
      created_at: now, updated_at: now,
    }]);
    setNewNote('');
    setNewNoteTimestamp('');
    setSavingNote(false);
    loadNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from('job_notes').delete().eq('id', noteId);
    loadNotes();
  };

  const saveNoteTimestamp = async (noteId: string) => {
    await supabase.from('job_notes').update({
      display_timestamp: editingNoteTs ? new Date(editingNoteTs).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);
    setEditingNoteTimestamp(null);
    loadNotes();
  };

  const toggleNoteInternal = async (noteId: string, currentValue: boolean) => {
    await supabase.from('job_notes').update({
      is_internal: !currentValue,
      updated_at: new Date().toISOString(),
    }).eq('id', noteId);
    loadNotes();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `jobs/${user?.id}/${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file);
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(path);
      await supabase.from('job_images').insert([{
        job_id: id, user_id: user?.id, image_url: urlData.publicUrl,
        file_name: file.name, file_size: file.size,
        display_timestamp: photoTimestamp ? new Date(photoTimestamp).toISOString() : null,
        author_type: 'admin',
        uploaded_at: new Date().toISOString(),
      }]);
    }
    setUploadingPhoto(false);
    loadImages();
  };

  const handleDeletePhoto = async (image: JobImage) => {
    const path = image.image_url.split('/job-photos/')[1];
    if (path) await supabase.storage.from('job-photos').remove([decodeURIComponent(path)]);
    await supabase.from('job_images').delete().eq('id', image.id);
    loadImages();
  };

  const saveImageTimestamp = async (imageId: string) => {
    await supabase.from('job_images').update({
      display_timestamp: editingImageTs ? new Date(editingImageTs).toISOString() : null,
    }).eq('id', imageId);
    setEditingImageTimestamp(null);
    loadImages();
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const file of Array.from(files)) {
      const path = `attachments/${user?.id}/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('job-attachments').upload(path, file);
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from('job-attachments').getPublicUrl(path);
      await supabase.from('job_attachments').insert([{
        job_id: id, user_id: user?.id, file_name: file.name,
        file_url: urlData.publicUrl, file_type: file.type,
        file_size: file.size, uploaded_at: new Date().toISOString(),
        uploader_email: user?.email, author_type: 'admin',
      }]);
    }
    setUploadingAttachment(false);
    loadAttachments();
  };

  const handleDeleteAttachment = async (attachment: JobAttachment) => {
    const path = attachment.file_url.split('/job-attachments/')[1];
    if (path) await supabase.storage.from('job-attachments').remove([decodeURIComponent(path)]);
    await supabase.from('job_attachments').delete().eq('id', attachment.id);
    loadAttachments();
  };

  // Line items
  const openAddLineItem = () => {
    setLineItemMode('inventory');
    setSelectedInventoryId('');
    setWriteInDesc('');
    setLineQty('1');
    setLinePrice('');
    setLinePriceIsOverride(false);
    setLineItemError('');
    setInventorySearch('');
    setShowLineItemModal(true);
  };

  const handleInventorySelect = async (invId: string) => {
    setSelectedInventoryId(invId);
    setLinePriceIsOverride(false);
    const inv = inventoryItems.find(i => i.id === invId);
    if (inv && job?.customer_id) {
      // Fetch the price (override or standard) for this customer
      try {
        const res = await fetch(`/api/pricing?customerId=${job.customer_id}&inventoryId=${invId}`);
        const data = await res.json();
        setLinePrice((data.price || inv.unit_price || inv.unit_cost || 0).toString());
        if (data.isOverride) setLinePriceIsOverride(true);
      } catch (err) {
        // Fallback to standard price
        setLinePrice((inv.unit_price || inv.unit_cost || 0).toString());
      }
    }
  };

  const handleSaveLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLineItemError('');
    const qty = parseFloat(lineQty) || 1;
    const price = parseFloat(linePrice) || 0;

    if (lineItemMode === 'inventory' && !selectedInventoryId) {
      setLineItemError('Please select an inventory item.');
      return;
    }
    if (lineItemMode === 'writein' && !writeInDesc.trim()) {
      setLineItemError('Description is required.');
      return;
    }

    setSavingLineItem(true);
    const { data: { session } } = await supabase.auth.getSession();

    let description = writeInDesc;
    let inventory_id = null;

    if (lineItemMode === 'inventory') {
      const inv = inventoryItems.find(i => i.id === selectedInventoryId);
      description = inv?.name || '';
      inventory_id = selectedInventoryId;
    }

    const { error } = await supabase.from('job_line_items').insert([{
      job_id: id,
      user_id: session?.user.id,
      description,
      quantity: qty,
      unit_price: price,
      amount: qty * price,
      inventory_id,
      created_at: new Date().toISOString(),
    }]);

    if (error) { setLineItemError(error.message); setSavingLineItem(false); return; }

    // Update job total_amount
    const newTotal = lineItems.reduce((sum, li) => sum + li.amount, 0) + (qty * price);
    await supabase.from('jobs').update({ total_amount: newTotal, updated_at: new Date().toISOString() }).eq('id', id);

    setSavingLineItem(false);
    setShowLineItemModal(false);
    await loadLineItems();
    await loadJob();
  };

  const handleDeleteLineItem = async (item: LineItem) => {
    await supabase.from('job_line_items').delete().eq('id', item.id);
    const remaining = lineItems.filter(li => li.id !== item.id);
    const newTotal = remaining.reduce((sum, li) => sum + li.amount, 0);
    await supabase.from('jobs').update({ total_amount: newTotal, updated_at: new Date().toISOString() }).eq('id', id);
    await loadLineItems();
    await loadJob();
  };

  // Totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;

  const openCreateReport = () => {
    setEditingReport(null);
    setReportForm({ title: job?.title || '', description: job?.description || '', work_performed: '', parts_used: '', labor_hours: '', labor_rate: '' });
    setReportForms({
      'safety-checklist': false,
      'equipment-inspection': false,
      'quality-assurance': false,
      'customer-signoff': false,
      'work-completion': false,
    });
    setReportTasks([]);
    setNewTaskDesc('');
    setReportError('');
    setShowReportModal(true);
  };

  const openEditReport = (report: ServiceReport) => {
    setEditingReport(report);
    setReportForm({
      title: report.title || '', description: report.description || '',
      work_performed: report.work_performed || '', parts_used: report.parts_used || '',
      labor_hours: report.labor_hours?.toString() || '', labor_rate: report.labor_rate?.toString() || '',
    });
    // Load forms and tasks from report if they exist
    const completedForms = (report as any).completed_forms ? JSON.parse((report as any).completed_forms) : [];
    const forms: Record<string, boolean> = {
      'safety-checklist': completedForms.includes('safety-checklist'),
      'equipment-inspection': completedForms.includes('equipment-inspection'),
      'quality-assurance': completedForms.includes('quality-assurance'),
      'customer-signoff': completedForms.includes('customer-signoff'),
      'work-completion': completedForms.includes('work-completion'),
    };
    setReportForms(forms);
    const tasks = (report as any).completed_tasks ? JSON.parse((report as any).completed_tasks) : [];
    setReportTasks(tasks);
    setNewTaskDesc('');
    setReportError('');
    setShowReportModal(true);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.title.trim()) { setReportError('Title is required.'); return; }
    setSavingReport(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      job_id: id, user_id: user?.id, title: reportForm.title,
      description: reportForm.description, work_performed: reportForm.work_performed,
      parts_used: reportForm.parts_used,
      labor_hours: reportForm.labor_hours ? parseFloat(reportForm.labor_hours) : null,
      labor_rate: reportForm.labor_rate ? parseFloat(reportForm.labor_rate) : null,
      completed_forms: JSON.stringify(Object.entries(reportForms).filter(([_,v]) => v).map(([k,_]) => k)),
      completed_tasks: JSON.stringify(reportTasks),
      updated_at: new Date().toISOString(),
    };
    if (editingReport) {
      await supabase.from('service_reports').update(payload).eq('id', editingReport.id);
    } else {
      await supabase.from('service_reports').insert([{ ...payload, created_at: new Date().toISOString() }]);
    }
    setSavingReport(false);
    setShowReportModal(false);
    loadReports();
  };

  const handleDeleteReport = async (reportId: string) => {
    await supabase.from('service_reports').delete().eq('id', reportId);
    loadReports();
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const filteredInventory = inventoryItems.filter(i =>
    i.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    (i.sku || '').toLowerCase().includes(inventorySearch.toLowerCase())
  );

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950"><Header />
      <div className="text-center py-20 text-slate-400">Loading job...</div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-slate-950"><Header />
      <div className="text-center py-20 text-slate-400">Job not found. <Link href="/jobs" className="text-blue-400 hover:underline">Back to jobs</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-8">

        <div className="mb-6">
          <Link href="/jobs" className="text-slate-500 hover:text-slate-300 text-sm transition">← Back to Jobs</Link>
        </div>

        {/* Job Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{job.title}</h2>
              <p className="text-slate-400">
                {customer ? (
                  <Link href="/customers" className="hover:text-blue-400 transition">
                    {customer.name}{customer.company_name ? ` — ${customer.company_name}` : ''}
                  </Link>
                ) : 'Unknown Customer'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[job.status]}`}>{job.status}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 ${priorityColors[job.priority]}`}>{job.priority} priority</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
            <div><p className="text-slate-500 text-xs mb-1">Scheduled</p><p className="text-white text-sm">{formatDate(job.scheduled_date)}</p></div>
            <div><p className="text-slate-500 text-xs mb-1">Created</p><p className="text-white text-sm">{formatDate(job.created_at)}</p></div>
            <div><p className="text-slate-500 text-xs mb-1">Total</p><p className="text-green-400 text-sm font-semibold">{job.total_amount ? `$${job.total_amount.toFixed(2)}` : '—'}</p></div>
            <div><p className="text-slate-500 text-xs mb-1">Completed</p><p className="text-white text-sm">{formatDate(job.completed_date)}</p></div>
          </div>
          {job.description && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs mb-1">Description</p>
              <p className="text-slate-300 text-sm">{job.description}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Line Items */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Line Items</h3>
                <div className="flex gap-2">
                  <button onClick={openAddLineItem}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg transition">
                    + Add Item
                  </button>
                </div>
              </div>

              {lineItems.length === 0 ? (
                <div onClick={openAddLineItem}
                  className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition">
                  <p className="text-3xl mb-2">🧾</p>
                  <p className="text-slate-400 text-sm">Add inventory items or custom line items</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left text-slate-400 font-medium pb-2">Description</th>
                          <th className="text-right text-slate-400 font-medium pb-2 w-16">Qty</th>
                          <th className="text-right text-slate-400 font-medium pb-2 w-24">Unit Price</th>
                          <th className="text-right text-slate-400 font-medium pb-2 w-24">Amount</th>
                          <th className="w-8 pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map(item => (
                          <tr key={item.id} className="border-b border-slate-700/50 group">
                            <td className="py-3 text-white">
                              {item.description}
                              {item.inventory_id && <span className="text-slate-500 text-xs ml-2">inventory</span>}
                            </td>
                            <td className="py-3 text-right text-slate-300">{item.quantity}</td>
                            <td className="py-3 text-right text-slate-300">${item.unit_price.toFixed(2)}</td>
                            <td className="py-3 text-right text-white font-medium">${item.amount.toFixed(2)}</td>
                            <td className="py-3 text-right">
                              <button onClick={() => handleDeleteLineItem(item)}
                                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Subtotal</span>
                      <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => setGstEnabled(g => !g)}
                          className={`relative w-9 h-5 rounded-full transition ${gstEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${gstEnabled ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-slate-400 text-sm">GST (10%)</span>
                      </label>
                      <span className="text-slate-300 text-sm">{gstEnabled ? `$${gstAmount.toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-green-400 font-bold text-lg">${total.toFixed(2)}</span>
                    </div>
                    <Link
                      href={`/jobs/${id}/invoice?gst=${gstEnabled}`}
                      className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition mt-2"
                    >
                      + Generate New Invoice
                    </Link>
                  </div>

                  {/* Saved Invoices */}
                  {invoices.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Saved Invoices</p>
                      {invoices.map((inv: any) => (
                        <Link key={inv.id} href={`/invoices`}
                          className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 hover:bg-slate-700 transition">
                          <div>
                            <p className="text-white text-sm font-medium">{inv.invoice_number}</p>
                            <p className="text-slate-500 text-xs">{new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-sm font-semibold">${(inv.total_amount || 0).toFixed(2)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              inv.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              inv.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-slate-600 text-slate-400'
                            }`}>{inv.status}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Attachments - Consolidated View (Customer & Admin Notes, Photos, Files) */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-6">Attachments & Collaboration</h3>

              {/* Customer Notes Section */}
              <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-indigo-700/30">
                <h4 className="text-indigo-300 font-medium text-sm mb-4">👤 Customer Notes</h4>
                {notes.filter(n => n.author_type === 'portal_user').length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-3 italic">No customer notes yet</p>
                ) : (
                  <div className="space-y-2">
                    {notes.filter(n => n.author_type === 'portal_user').map(note => (
                      <div key={note.id} className="bg-slate-900 rounded-lg px-3 py-2">
                        <p className="text-slate-300 text-sm">{note.content}</p>
                        <p className="text-slate-600 text-xs mt-1">{formatDateTime(note.display_timestamp || note.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Your Notes Section (Admin) */}
              <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
                <h4 className="text-slate-300 font-medium text-sm mb-4">📝 Your Notes</h4>
                <form onSubmit={handleAddNote} className="space-y-2 mb-4">
                  <div className="flex gap-2">
                    <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                      className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                    <button type="submit" disabled={savingNote || !newNote.trim()}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">Add</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">Timestamp:</span>
                    <input type="datetime-local" value={newNoteTimestamp} onChange={e => setNewNoteTimestamp(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 transition" />
                    {newNoteTimestamp && <button type="button" onClick={() => setNewNoteTimestamp('')} className="text-slate-500 hover:text-slate-300 text-xs transition">clear</button>}
                    {!newNoteTimestamp && <span className="text-slate-600 text-xs italic">defaults to now</span>}
                  </div>
                </form>
                {notes.filter(n => n.author_type === 'admin').length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-3 italic">No notes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {notes.filter(n => n.author_type === 'admin').map(note => (
                      <div key={note.id} className="flex gap-3 group">
                        <div className="flex-1 bg-slate-900 rounded-lg px-4 py-3">
                          <p className="text-slate-300 text-sm">{note.content}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {editingNoteTimestamp === note.id ? (
                              <div className="flex items-center gap-1">
                                <input type="datetime-local" value={editingNoteTs} onChange={e => setEditingNoteTs(e.target.value)}
                                  className="bg-slate-800 border border-slate-600 text-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500" />
                                <button onClick={() => saveNoteTimestamp(note.id)} className="text-green-400 hover:text-green-300 text-xs transition">✓</button>
                                <button onClick={() => setEditingNoteTimestamp(null)} className="text-slate-500 hover:text-slate-300 text-xs transition">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingNoteTimestamp(note.id); setEditingNoteTs(note.display_timestamp ? note.display_timestamp.slice(0, 16) : note.created_at.slice(0, 16)); }}
                                className="text-slate-600 hover:text-slate-400 text-xs transition" title="Edit timestamp">
                                {formatDateTime(note.display_timestamp || note.created_at)}
                                {note.display_timestamp && note.display_timestamp !== note.created_at && (
                                  <span className="ml-1 text-yellow-600">✎</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => toggleNoteInternal(note.id, note.is_internal || false)}
                            className={`text-sm transition ${note.is_internal ? 'text-orange-400 hover:text-orange-300' : 'text-slate-600 hover:text-slate-400'}`}
                            title={note.is_internal ? 'Hidden from portal users' : 'Visible to portal users'}>
                            {note.is_internal ? '🔒' : '👁️'}
                          </button>
                          <button onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-600 hover:text-red-400 text-sm transition">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos Section - Customer + Admin */}
              <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-slate-300 font-medium text-sm">📷 Photos</h4>
                  <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition">
                    {uploadingPhoto ? 'Uploading...' : '+ Add Photos'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </div>
                {/* Timestamp for next upload */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-slate-500 text-xs">Timestamp uploads:</span>
                  <input type="datetime-local" value={photoTimestamp} onChange={e => setPhotoTimestamp(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 transition" />
                  {photoTimestamp && <button onClick={() => setPhotoTimestamp('')} className="text-slate-500 hover:text-slate-300 text-xs transition">clear</button>}
                </div>

                {/* Customer Photos */}
                {images.filter(img => img.author_type === 'portal_user').length > 0 && (
                  <div className="mb-4 pb-4 border-b border-slate-700">
                    <p className="text-indigo-300 text-xs font-medium mb-2">👤 Customer Photos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.filter(img => img.author_type === 'portal_user').map(img => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden bg-slate-700">
                          <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setLightbox(img.image_url)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Your Photos */}
                {images.filter(img => img.author_type === 'admin').length > 0 && (
                  <div>
                    <p className="text-slate-300 text-xs font-medium mb-2">📸 Your Photos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.filter(img => img.author_type === 'admin').map(img => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden bg-slate-700">
                          <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setLightbox(img.image_url)} />
                          <button onClick={async () => {
                            await supabase.from('job_images').update({ is_internal: !(img.is_internal as any) }).eq('id', img.id);
                            loadImages();
                          }} className={`absolute top-1 left-1 rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center transition ${(img.is_internal as any) ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>{(img.is_internal as any) ? '🔒' : '👁'}</button>
                          <button onClick={() => handleDeletePhoto(img)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center transition">✕</button>
                          <div className="px-2 py-1 bg-slate-800/90">
                            {editingImageTimestamp === img.id ? (
                              <div className="flex items-center gap-1">
                                <input type="datetime-local" value={editingImageTs} onChange={e => setEditingImageTs(e.target.value)}
                                  className="flex-1 bg-slate-700 border border-slate-500 text-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none" />
                                <button onClick={() => saveImageTimestamp(img.id)} className="text-green-400 text-xs transition">✓</button>
                                <button onClick={() => setEditingImageTimestamp(null)} className="text-slate-500 text-xs transition">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingImageTimestamp(img.id); setEditingImageTs((img.display_timestamp || img.uploaded_at).slice(0, 16)); }}
                                className="text-slate-500 hover:text-slate-300 text-xs transition w-full text-left truncate">
                                {formatDateTime(img.display_timestamp || img.uploaded_at)}
                                {img.display_timestamp && img.display_timestamp !== img.uploaded_at && <span className="ml-1 text-yellow-600">✎</span>}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {images.length === 0 && (
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition">
                    <p className="text-3xl mb-2">📷</p>
                    <p className="text-slate-400 text-sm">Click to upload job photos</p>
                  </div>
                )}
              </div>

              {/* Files Section */}
              <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-slate-300 font-medium text-sm">📎 Files</h4>
                  <button onClick={() => attachRef.current?.click()} disabled={uploadingAttachment}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition">
                    {uploadingAttachment ? 'Uploading...' : '+ Add Files'}
                  </button>
                  <input ref={attachRef} type="file" multiple onChange={handleAttachmentUpload} className="hidden" />
                </div>
                {attachments.length === 0 ? (
                  <div onClick={() => attachRef.current?.click()}
                    className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition">
                    <p className="text-3xl mb-2">📎</p>
                    <p className="text-slate-400 text-sm">Click to attach files — PDFs, Word docs, spreadsheets, and more</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.length > 0 && (
                      <input type="text" value={attachmentSearch} onChange={e => setAttachmentSearch(e.target.value)}
                        placeholder="Search by filename or uploader..."
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    )}
                    {attachments.filter(att => {
                      const q = attachmentSearch.toLowerCase();
                      return (att.file_name?.toLowerCase().includes(q) ||
                              (att.uploader_email as any)?.toLowerCase().includes(q));
                    }).map(att => (
                      <div key={att.id} className="flex items-center gap-3 bg-slate-900 rounded-lg px-4 py-3 group">
                        <span className="text-2xl flex-shrink-0">{fileIcon(att.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{att.file_name}</p>
                          <p className="text-slate-500 text-xs">{formatSize(att.file_size)} · {formatDate(att.uploaded_at)} · {(att.uploader_email as any) || 'Unknown'}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {att.file_type === 'application/pdf' ? (
                            <button onClick={() => setPreviewAttachment(att)}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition">View</button>
                          ) : att.file_type.startsWith('image/') ? (
                            <button onClick={() => setLightbox(att.file_url)}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition">View</button>
                          ) : (
                            <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition">Open</a>
                          )}
                          <a href={att.file_url} download={att.file_name}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition">↓</a>
                          <button onClick={async () => {
                            await supabase.from('job_attachments').update({ is_internal: !(att.is_internal as any) }).eq('id', att.id);
                            loadAttachments();
                          }}
                            className={`text-xs px-2 py-1.5 rounded-lg transition ${(att.is_internal as any) ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {(att.is_internal as any) ? '🔒 Internal' : '👁 Visible'}
                          </button>
                          <button onClick={() => handleDeleteAttachment(att)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-2 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                      </div>
                    ))}
                    <div onClick={() => attachRef.current?.click()}
                      className="flex items-center gap-3 border-2 border-dashed border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-500 transition">
                      <span className="text-slate-500 text-xl">+</span>
                      <span className="text-slate-500 text-sm">Add more files</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Digital Signature Section */}
              {job.status === 'completed' && (
                <div className="bg-slate-800 rounded-lg p-4 border border-green-700/30">
                  <h4 className="text-green-300 font-medium text-sm mb-4">✍️ Digital Signature</h4>
                  {job.signature_data ? (
                    <div>
                      <img src={job.signature_data} alt="Signature" className="max-w-xs border border-slate-600 rounded-lg mb-3" />
                      <p className="text-slate-400 text-xs">Signed by {job.signed_by} on {job.signed_at ? new Date(job.signed_at).toLocaleString() : 'unknown date'}</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm italic">Waiting for customer signature...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Service Reports</h3>
                <button onClick={openCreateReport}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition">+ New</button>
              </div>
              {reports.length === 0 ? (
                <div className="text-center py-6"><p className="text-3xl mb-2">📄</p><p className="text-slate-500 text-sm">No reports yet.</p></div>
              ) : (
                <div className="space-y-3">
                  {reports.map(report => (
                    <div key={report.id} className="bg-slate-900 rounded-lg p-4">
                      <p className="text-white text-sm font-medium mb-1">{report.title}</p>
                      <p className="text-slate-500 text-xs mb-3">{formatDate(report.created_at)}</p>
                      <div className="flex gap-2">
                        <Link href={`/jobs/${id}/report?reportId=${report.id}`}
                          className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 rounded-lg transition">View / Print</Link>
                        <button onClick={() => openEditReport(report)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 rounded-lg transition">Edit</button>
                        <button onClick={() => handleDeleteReport(report.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-2 py-1.5 rounded-lg transition">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Expenses</h3>
                <button onClick={() => setShowExpenseModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition">+ Add</button>
              </div>
              {expenses.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No expenses recorded.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {expenses.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between bg-slate-900 rounded p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{exp.description}</p>
                        <p className="text-slate-400 text-xs">{exp.expense_type}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">${exp.amount.toFixed(2)}</span>
                        <button onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-500 hover:text-red-400 text-xs transition">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-700 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Expenses:</span>
                  <span className="text-orange-400 font-semibold">${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Time Tracking */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Time Tracking</h3>
                <button onClick={() => setShowTimeModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition">+ Log Hours</button>
              </div>
              {timeEntries.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No time entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {timeEntries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center bg-slate-900 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">{entry.hours}h on {new Date(entry.date_worked).toLocaleDateString()}</p>
                        {entry.description && <p className="text-slate-400 text-xs">{entry.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteTimeEntry(entry.id)}
                        className="text-slate-500 hover:text-red-400 text-xs transition">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-700 pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Hours:</span>
                  <span className="text-blue-400 font-semibold">{timeEntries.reduce((s, t) => s + t.hours, 0).toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Job Profitability */}
            {job && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Profitability</h3>
                {(() => {
                  const revenue = job.total_amount || 0;
                  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
                  const profit = revenue - expenseTotal;
                  const margin = revenue > 0 ? (profit / revenue * 100) : 0;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">Revenue:</span><span className="text-white font-semibold">${revenue.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Expenses:</span><span className="text-orange-400">${expenseTotal.toFixed(2)}</span></div>
                      <div className="border-t border-slate-700 pt-2 flex justify-between">
                        <span className="text-slate-300 font-medium">Profit:</span>
                        <span className={`font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Margin:</span><span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>{margin.toFixed(1)}%</span></div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Scheduled Visits */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Scheduled Visits</h3>
                <button onClick={() => setShowVisitModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition">
                  + Add Visit
                </button>
              </div>
              {visits.length === 0 ? (
                <p className="text-slate-500 text-sm">No visits scheduled</p>
              ) : (
                <div className="space-y-2">
                  {visits.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-white text-sm font-medium">{new Date(v.scheduled_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        {v.duration_hours && <p className="text-slate-500 text-xs">{v.duration_hours}h</p>}
                        {v.notes && <p className="text-slate-400 text-xs mt-0.5">{v.notes}</p>}
                      </div>
                      <select value={v.status} onChange={e => updateVisitStatus(v.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1 border-0 focus:outline-none cursor-pointer ${
                          v.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          v.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {customer && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">
                  {customer.customer_type === 'sub_contact' ? 'Billing' : 'Customer'}
                </h3>

                {/* Sub-contact: show contractor (main biller) first */}
                {customer.customer_type === 'sub_contact' && contractor && (
                  <div className="mb-4 pb-4 border-b border-slate-700">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Contractor</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-white font-medium">{contractor.name}</p>
                      {contractor.company_name && <p className="text-slate-400">{contractor.company_name}</p>}
                      {contractor.email && <p className="text-slate-400">✉️ {contractor.email}</p>}
                      {contractor.phone && <p className="text-slate-400">📞 {contractor.phone}</p>}
                      {contractor.address && <p className="text-slate-400">📍 {contractor.address}</p>}
                    </div>
                  </div>
                )}

                {/* The direct customer (or sub-contact) */}
                <div>
                  {customer.customer_type === 'sub_contact' && (
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">Sub-Contact</p>
                  )}
                  <div className="space-y-1 text-sm">
                    <p className="text-white font-medium">{customer.name}</p>
                    {customer.company_name && <p className="text-slate-400">{customer.company_name}</p>}
                    {customer.email && <p className="text-slate-400">✉️ {customer.email}</p>}
                    {customer.phone && <p className="text-slate-400">📞 {customer.phone}</p>}
                    {customer.address && <p className="text-slate-400">📍 {customer.address}</p>}
                    {customer.city && <p className="text-slate-400">{[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Visit Modal */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Schedule a Visit</h3>
              <button onClick={() => setShowVisitModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleAddVisit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Date & Time *</label>
                <input type="datetime-local" value={visitForm.scheduled_date}
                  onChange={e => setVisitForm({ ...visitForm, scheduled_date: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Duration (hours)</label>
                <input type="number" min="0" step="0.5" value={visitForm.duration_hours}
                  onChange={e => setVisitForm({ ...visitForm, duration_hours: e.target.value })}
                  placeholder="e.g. 2"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
                <input type="text" value={visitForm.notes}
                  onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })}
                  placeholder="Optional note for this visit"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowVisitModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingVisit || !visitForm.scheduled_date}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition">
                  {savingVisit ? 'Saving...' : 'Add Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Line Item Modal */}
      {showLineItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Add Line Item</h3>
              <button onClick={() => setShowLineItemModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <div className="px-6 pt-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setLineItemMode('inventory')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${lineItemMode === 'inventory' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  From Inventory
                </button>
                <button
                  onClick={() => setLineItemMode('writein')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${lineItemMode === 'writein' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  Write In
                </button>
              </div>
            </div>
            <form onSubmit={handleSaveLineItem} className="px-6 pb-6 space-y-4">
              {lineItemError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{lineItemError}</div>}

              {lineItemMode === 'inventory' ? (
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Search Inventory</label>
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={e => setInventorySearch(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredInventory.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">No items found.</p>
                    ) : filteredInventory.map(inv => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => handleInventorySelect(inv.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                          selectedInventoryId === inv.id ? 'bg-blue-500/20 border border-blue-500/50 text-white' : 'bg-slate-900 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <span>{inv.name}{inv.sku ? <span className="text-slate-500 ml-2 text-xs">{inv.sku}</span> : null}</span>
                        <span className="text-slate-400 text-xs">${(inv.unit_price || inv.unit_cost || 0).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Description *</label>
                  <input type="text" value={writeInDesc} onChange={e => setWriteInDesc(e.target.value)}
                    placeholder="e.g. Call out fee, Travel, Custom work..."
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Quantity</label>
                  <input type="number" min="0.01" step="0.01" value={lineQty} onChange={e => setLineQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 text-sm font-medium">Unit Price ($)</label>
                    {linePriceIsOverride && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Custom Price</span>
                    )}
                  </div>
                  <input type="number" min="0" step="0.01" value={linePrice} onChange={e => { setLinePrice(e.target.value); setLinePriceIsOverride(false); }}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition mt-1" />
                </div>
              </div>

              {lineQty && linePrice && (
                <div className="bg-slate-900 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Line Total</span>
                  <span className="text-white font-bold">${(parseFloat(lineQty) * parseFloat(linePrice)).toFixed(2)}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLineItemModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingLineItem} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingLineItem ? 'Adding...' : 'Add to Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">{editingReport ? 'Edit Report' : 'New Service Report'}</h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveReport} className="p-6 space-y-4">
              {reportError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{reportError}</div>}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Report Title *</label>
                <input type="text" value={reportForm.title} onChange={e => setReportForm({ ...reportForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="Service Report — Job Title" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Job Description</label>
                <textarea value={reportForm.description} onChange={e => setReportForm({ ...reportForm, description: e.target.value })} rows={3}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="Brief description of the job..." />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Work Performed</label>
                <textarea value={reportForm.work_performed} onChange={e => setReportForm({ ...reportForm, work_performed: e.target.value })} rows={4}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="Detailed description of work carried out..." />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Parts / Materials Used</label>
                <textarea value={reportForm.parts_used} onChange={e => setReportForm({ ...reportForm, parts_used: e.target.value })} rows={2}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="List parts and materials used..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Labour Hours</label>
                  <input type="number" min="0" step="0.5" value={reportForm.labor_hours} onChange={e => setReportForm({ ...reportForm, labor_hours: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Labour Rate ($/hr)</label>
                  <input type="number" min="0" step="0.01" value={reportForm.labor_rate} onChange={e => setReportForm({ ...reportForm, labor_rate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" placeholder="0.00" />
                </div>
              </div>

              {/* Forms Section */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Forms Completed</h4>
                <div className="space-y-2">
                  {Object.entries({
                    'safety-checklist': '☑️ Safety Checklist',
                    'equipment-inspection': '☑️ Equipment Inspection',
                    'quality-assurance': '☑️ Quality Assurance',
                    'customer-signoff': '☑️ Customer Sign-off',
                    'work-completion': '☑️ Work Completion Checklist',
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={reportForms[key]} onChange={e => setReportForms({ ...reportForms, [key]: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 cursor-pointer" />
                      <span className="text-slate-300 text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Completed Tasks Section */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-3">Completed Tasks</h4>
                {reportTasks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {reportTasks.map(task => (
                      <label key={task.id} className="flex items-center gap-2 cursor-pointer bg-slate-900 p-2 rounded-lg">
                        <input type="checkbox" checked={task.completed} onChange={e => {
                          setReportTasks(reportTasks.map(t => t.id === task.id ? { ...t, completed: e.target.checked } : t));
                        }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 cursor-pointer" />
                        <span className={`text-sm flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{task.description}</span>
                        <button type="button" onClick={() => setReportTasks(reportTasks.filter(t => t.id !== task.id))}
                          className="text-slate-500 hover:text-red-400 text-xs transition">✕</button>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} placeholder="Add task..."
                    className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    onKeyPress={e => {
                      if (e.key === 'Enter' && newTaskDesc.trim()) {
                        setReportTasks([...reportTasks, { id: Math.random().toString(), description: newTaskDesc, completed: false }]);
                        setNewTaskDesc('');
                      }
                    }} />
                  <button type="button" onClick={() => {
                    if (newTaskDesc.trim()) {
                      setReportTasks([...reportTasks, { id: Math.random().toString(), description: newTaskDesc, completed: false }]);
                      setNewTaskDesc('');
                    }
                  }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-2 rounded-lg transition">+</button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingReport} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingReport ? 'Saving...' : editingReport ? 'Save Changes' : 'Create Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-700">
            <p className="text-white text-sm font-medium">{previewAttachment.file_name}</p>
            <div className="flex gap-3">
              <a href={previewAttachment.file_url} download={previewAttachment.file_name}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-1.5 rounded-lg transition">↓ Download</a>
              <button onClick={() => setPreviewAttachment(null)} className="text-slate-400 hover:text-white text-xl transition">✕</button>
            </div>
          </div>
          <iframe src={previewAttachment.file_url} className="flex-1 w-full" title={previewAttachment.file_name} />
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Add Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              {expenseError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{expenseError}</div>}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Description *</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Materials purchased" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Type</label>
                <select value={expenseForm.expense_type} onChange={e => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="materials">Materials</option>
                  <option value="labor">Labor</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Amount ($) *</label>
                <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0.00" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingExpense} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingExpense ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Entry Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Log Time</h3>
              <button onClick={() => setShowTimeModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveTimeEntry} className="p-6 space-y-4">
              {timeError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{timeError}</div>}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Date *</label>
                <input type="date" value={timeForm.date_worked} onChange={e => setTimeForm({ ...timeForm, date_worked: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Hours *</label>
                <input type="number" min="0.5" step="0.5" value={timeForm.hours} onChange={e => setTimeForm({ ...timeForm, hours: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. 2.5" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
                <input type="text" value={timeForm.description} onChange={e => setTimeForm({ ...timeForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Installation work" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTimeModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingTime} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingTime ? 'Saving...' : 'Log Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-slate-300 transition">✕</button>
        </div>
      )}
    </div>
  );
}
