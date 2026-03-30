import React, { useState, useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import { Document, DocumentStatus, ApprovalLog } from '../types';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Letterhead } from '../components/Letterhead';

export function DocumentCreator() {
  const navigate = useNavigate();
  const { templates, departments, addDocument, documents, clients } = useStore();
  const { profile, isAdmin } = useAuthStore();
  const { settings } = useSettingsStore();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [title, setTitle] = useState('');
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | HTMLTextAreaElement | null>>({});

  const PAGE_HEIGHT = 1122.5;
  const HEADER_HEIGHT = 151;
  const FOOTER_HEIGHT = 132;
  const SAFE_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT; // 839.5

  useLayoutEffect(() => {
    let changed = false;
    const newHeights = { ...measuredHeights };
    Object.entries(fieldRefs.current).forEach(([id, el]) => {
      if (el) {
        const textarea = el.querySelector('textarea');
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
        const height = el.getBoundingClientRect().height;
        if (Math.abs((newHeights[id] || 0) - height) > 2) {
          newHeights[id] = height;
          changed = true;
        }
      }
    });
    if (changed) {
      setMeasuredHeights(newHeights);
    }
  });

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    if (activeFieldId && fieldRefs.current[activeFieldId]) {
      const el = fieldRefs.current[activeFieldId];
      if (el) {
        const input = el.querySelector('input, textarea, select') as HTMLElement;
        if (input) {
          input.focus();
        }
      }
    }
  }, [activeFieldId, measuredHeights]);

  const { totalPages, fixedFields, flowFields } = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.fields) return { totalPages: 1, fixedFields: [], flowFields: [] };
    
    const rawFlowFields: any[] = [];
    const fixedFields: any[] = [];
    let maxFixedPageIndex = 0;

    selectedTemplate.fields.forEach(field => {
        const actualH = measuredHeights[field.id] || Number(field.h) || 60;
        const y = Number(field.y) || 0;
        const pageIndex = Math.floor(y / PAGE_HEIGHT);
        const offsetOnPage = y % PAGE_HEIGHT;

        if (offsetOnPage < HEADER_HEIGHT || offsetOnPage > PAGE_HEIGHT - FOOTER_HEIGHT) {
            fixedFields.push({ ...field, actualH, pageIndex, offsetOnPage });
            maxFixedPageIndex = Math.max(maxFixedPageIndex, pageIndex);
        } else {
            // Calculate the original logical Y as if it were in a continuous safe area
            const originalLogicalY = pageIndex * SAFE_HEIGHT + (offsetOnPage - HEADER_HEIGHT);
            rawFlowFields.push({ ...field, actualH, originalLogicalY, origH: Number(field.h) || 60 });
        }
    });

    // Sort flow fields by their original logical Y
    rawFlowFields.sort((a, b) => a.originalLogicalY - b.originalLogicalY);

    // Group into rows
    const rows: { originalLogicalY: number, fields: any[], actualMaxH: number, originalMaxH: number }[] = [];
    rawFlowFields.forEach(field => {
        let added = false;
        for (const row of rows) {
            if (Math.abs(row.originalLogicalY - field.originalLogicalY) < 20) {
                row.fields.push(field);
                row.actualMaxH = Math.max(row.actualMaxH, field.actualH);
                row.originalMaxH = Math.max(row.originalMaxH, field.origH);
                added = true;
                break;
            }
        }
        if (!added) {
            rows.push({ 
                originalLogicalY: field.originalLogicalY, 
                fields: [field], 
                actualMaxH: field.actualH, 
                originalMaxH: field.origH 
            });
        }
    });

    const flowFields: any[] = [];
    let previousRowBottom = 0;
    let maxLogicalBottom = 0;

    rows.forEach((row, index) => {
        let logicalY = row.originalLogicalY;

        if (index > 0) {
            const previousRow = rows[index - 1];
            const originalGap = row.originalLogicalY - (previousRow.originalLogicalY + previousRow.originalMaxH);
            logicalY = Math.max(row.originalLogicalY, previousRowBottom + originalGap);
        }

        // Optional: If the row fits on a single page but crosses a page boundary, push it to the next page
        const pageOfLogicalY = Math.floor(logicalY / SAFE_HEIGHT);
        const pageOfLogicalBottom = Math.floor((logicalY + row.actualMaxH) / SAFE_HEIGHT);
        
        if (pageOfLogicalBottom > pageOfLogicalY && row.actualMaxH <= SAFE_HEIGHT) {
            // Push to the start of the next page
            logicalY = pageOfLogicalBottom * SAFE_HEIGHT;
        }

        row.fields.forEach(field => {
            flowFields.push({
                ...field,
                logicalY: logicalY
            });
        });

        previousRowBottom = logicalY + row.actualMaxH;
        maxLogicalBottom = Math.max(maxLogicalBottom, previousRowBottom);
    });

    const totalPages = Math.max(1, Math.ceil(maxLogicalBottom / SAFE_HEIGHT), maxFixedPageIndex + 1);

    return { totalPages, fixedFields, flowFields };
  }, [selectedTemplate, measuredHeights]);

  const filteredTemplates = templates.filter(t => {
    const matchesDept = selectedDepartment === 'All' || t.departmentId === selectedDepartment;
    const userDeptId = departments.find(d => d.name === profile?.department)?.id;
    const matchesUserDept = isAdmin || !profile?.department || t.departmentId === userDeptId;
    return matchesDept && matchesUserDept;
  });

  const generateSerialNumber = (prefix: string) => {
    const year = new Date().getFullYear();
    const typeDocs = documents.filter(d => d.serialNumber.startsWith(`${prefix}-${year}`));
    const count = typeDocs.length + 1;
    return `${prefix}-${year}-${count.toString().padStart(4, '0')}`;
  };

  const handleSave = async (status: DocumentStatus) => {
    if (!selectedTemplate) return;
    if (!title) return alert('Document title is required');
    if (!profile) return alert('You must be logged in to create a document');

    if (selectedTemplate.type === 'document') {
      // Basic validation for document fields
      for (const field of selectedTemplate.fields) {
        if (field.required && !formData[field.name]) {
          return alert(`${field.label} is required`);
        }
      }
    }

    const serialNumber = generateSerialNumber(selectedTemplate.prefix);
    const docId = `d${Date.now()}`;

    const initialLog: ApprovalLog = {
      id: `l${Date.now()}`,
      userId: profile.uid,
      action: status === 'Submitted' ? 'Submitted' : 'Submitted',
      timestamp: new Date().toISOString(),
      level: 0
    };

    const newDoc: Document = {
      id: docId,
      templateId: selectedTemplate.id,
      templateType: selectedTemplate.type,
      serialNumber,
      title,
      departmentId: selectedTemplate.departmentId || '',
      data: formData,
      status,
      creatorId: profile.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: status === 'Submitted' ? [initialLog] : []
    };

    try {
      await addDocument(newDoc);
      navigate(`/documents/${docId}`);
    } catch (error: any) {
      console.error('Failed to save document:', error);
      let errorMessage = 'Failed to save document. Please try again.';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        if (error.message) errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const getCellStyle = (field: any, row: number, col: number) => {
    return field.cellStyles?.find((s: any) => s.row === row && s.col === col);
  };

  const isCellMerged = (field: any, row: number, col: number) => {
    if (!field.cellStyles) return false;
    for (const style of field.cellStyles) {
      if ((style.rowSpan && style.rowSpan > 1) || (style.colSpan && style.colSpan > 1)) {
        if (row >= style.row && row < style.row + (style.rowSpan || 1) &&
            col >= style.col && col < style.col + (style.colSpan || 1)) {
          if (row === style.row && col === style.col) return false;
          return true;
        }
      }
    }
    return false;
  };

  const renderField = (field: any, isFixed: boolean, pageIndex: number, topInsideSafeArea: number) => {
    return (
      <div 
        key={`${field.id || 'field'}-${pageIndex}`} 
        ref={(el) => { 
          if (isFixed || pageIndex === Math.floor((field.logicalY || 0) / SAFE_HEIGHT)) {
            fieldRefs.current[field.id || ''] = el as any; 
          }
        }}
        className="absolute flex flex-col group"
        style={{
          left: field.x || 0,
          top: topInsideSafeArea,
          width: field.w || 200,
          height: field.actualH || field.h || 60,
          fontWeight: field.bold ? 'bold' : 'normal',
          fontStyle: field.italic ? 'italic' : 'normal',
          textDecoration: field.underline ? 'underline' : 'none',
          textAlign: field.align || 'left',
          color: field.color || 'inherit',
          backgroundColor: field.backgroundColor || (field.type !== 'static-text' && field.type !== 'image' && field.type !== 'signature' && field.type !== 'table' ? '#ffffff' : 'transparent'),
          borderColor: field.borderColor || (field.type !== 'static-text' && field.type !== 'image' && field.type !== 'signature' && field.type !== 'table' ? '#cbd5e1' : 'transparent'),
          borderWidth: field.borderWidth !== undefined ? `${field.borderWidth}px` : (field.type !== 'static-text' && field.type !== 'image' && field.type !== 'signature' && field.type !== 'table' ? '1px' : '0px'),
          borderStyle: field.borderWidth || (field.type !== 'static-text' && field.type !== 'image' && field.type !== 'signature' && field.type !== 'table') ? 'solid' : 'none',
          borderRadius: field.borderRadius !== undefined ? `${field.borderRadius}px` : (field.type !== 'static-text' && field.type !== 'image' && field.type !== 'signature' && field.type !== 'table' ? '6px' : '0px'),
          fontSize: field.fontSize ? `${field.fontSize}px` : 'inherit',
          fontFamily: field.fontFamily || 'inherit',
        }}
      >
        {field.type !== 'static-text' && (
          <label 
            className="text-sm font-semibold text-slate-700 flex items-center mb-1 shrink-0 print:hidden"
            data-html2canvas-ignore="true"
          >
            {field.label} {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="flex-1 w-full relative">
          {field.type === 'static-text' && (
            <div className="whitespace-pre-wrap w-full min-h-full" style={{ textAlign: 'inherit' }}>
              {field.content || ''}
            </div>
          )}

          {field.type === 'table' && (
            <table 
              className="w-full h-full border-collapse table-fixed"
              style={{ 
                tableLayout: 'fixed',
                width: '100%',
                height: '100%',
                borderColor: field.borderColor || '#cbd5e1',
                borderWidth: field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px',
                borderStyle: 'solid'
              }}
            >
              <colgroup>
                {Array.from({ length: field.cols || 2 }).map((_, i) => (
                  <col key={i} style={{ width: field.colWidths?.[i] || `${100 / (field.cols || 2)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {Array.from({ length: field.cols || 2 }).map((_, i) => (
                    <th 
                      key={i} 
                      className="px-2 py-1"
                      style={{ 
                        borderColor: field.borderColor || '#cbd5e1',
                        borderWidth: field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px',
                        borderStyle: 'solid',
                        color: field.color || 'inherit',
                        textAlign: field.align || 'left',
                        fontWeight: field.bold ? 'bold' : 'normal',
                        fontStyle: field.italic ? 'italic' : 'normal',
                        textDecoration: field.underline ? 'underline' : 'none',
                        fontFamily: field.fontFamily || 'inherit',
                        fontSize: field.fontSize ? `${field.fontSize}px` : 'inherit',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {field.options?.[i] || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: field.rows || 2 }).map((_, rowIndex) => {
                  const rowData = (formData[field.name] || [])[rowIndex] || {};
                  return (
                    <tr key={rowIndex} style={{ height: field.rowHeights?.[rowIndex] || 'auto' }}>
                      {Array.from({ length: field.cols || 2 }).map((_, colIndex) => {
                        if (isCellMerged(field, rowIndex, colIndex)) return null;
                        const cellStyle = getCellStyle(field, rowIndex, colIndex);
                        const colName = field.options?.[colIndex] || `Col ${colIndex + 1}`;
                        return (
                          <td 
                            key={colIndex} 
                            className="p-0"
                            colSpan={cellStyle?.colSpan || 1}
                            rowSpan={cellStyle?.rowSpan || 1}
                            style={{ 
                              borderColor: field.borderColor || '#cbd5e1',
                              borderWidth: field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px',
                              borderStyle: 'solid',
                              backgroundColor: cellStyle?.backgroundColor || 'transparent',
                              width: cellStyle?.width || 'auto',
                              height: cellStyle?.height || 'auto',
                            }}
                          >
                            <textarea
                              value={rowData[colName] || ''}
                              onChange={(e) => {
                                const newTableData = [...(formData[field.name] || [])];
                                if (!newTableData[rowIndex]) newTableData[rowIndex] = {};
                                newTableData[rowIndex] = { ...newTableData[rowIndex], [colName]: e.target.value };
                                setFormData({ ...formData, [field.name]: newTableData });
                              }}
                              className="w-full h-full p-2 border-none focus:ring-0 bg-transparent resize-none"
                              style={{
                                color: cellStyle?.color || field.color || 'inherit',
                                fontFamily: field.fontFamily || 'inherit',
                                fontSize: field.fontSize ? `${field.fontSize}px` : 'inherit',
                                textAlign: cellStyle?.align || field.align || 'left',
                                fontWeight: cellStyle?.bold !== undefined ? (cellStyle.bold ? 'bold' : 'normal') : (field.bold ? 'bold' : 'normal'),
                                fontStyle: cellStyle?.italic !== undefined ? (cellStyle.italic ? 'italic' : 'normal') : (field.italic ? 'italic' : 'normal'),
                                textDecoration: cellStyle?.underline !== undefined ? (cellStyle.underline ? 'underline' : 'none') : (field.underline ? 'underline' : 'none'),
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                overflow: 'hidden'
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {field.type === 'text' && (
            <input
              type="text"
              value={formData[field.name] || ''}
              onFocus={() => setActiveFieldId(field.id)}
              onBlur={(e) => {
                if (document.body.contains(e.target)) {
                  setActiveFieldId(null);
                }
              }}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="absolute inset-0 w-full h-full p-2 focus:ring-2 focus:ring-indigo-500"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textAlign: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
              }}
              required={field.required}
            />
          )}
          
          {field.type === 'textarea' && (
            <textarea
              value={formData[field.name] || ''}
              onFocus={() => setActiveFieldId(field.id)}
              onBlur={(e) => {
                if (document.body.contains(e.target)) {
                  setActiveFieldId(null);
                }
              }}
              onChange={(e) => {
                setFormData({ ...formData, [field.name]: e.target.value });
              }}
              className="w-full min-h-full p-2 focus:ring-2 focus:ring-indigo-500 resize-none overflow-hidden"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textAlign: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
              }}
              required={field.required}
            />
          )}
          
          {field.type === 'number' && (
            <input
              type="number"
              value={formData[field.name] || ''}
              onFocus={() => setActiveFieldId(field.id)}
              onBlur={(e) => {
                if (document.body.contains(e.target)) {
                  setActiveFieldId(null);
                }
              }}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="absolute inset-0 w-full h-full p-2 focus:ring-2 focus:ring-indigo-500"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textAlign: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
              }}
              required={field.required}
            />
          )}
          
          {field.type === 'date' && (
            <input
              type="date"
              value={formData[field.name] || ''}
              onFocus={() => setActiveFieldId(field.id)}
              onBlur={(e) => {
                if (document.body.contains(e.target)) {
                  setActiveFieldId(null);
                }
              }}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="absolute inset-0 w-full h-full p-2 focus:ring-2 focus:ring-indigo-500"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textAlign: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
              }}
              required={field.required}
            />
          )}
          
          {field.type === 'dropdown' && (
            <select
              value={formData[field.name] || ''}
              onFocus={() => setActiveFieldId(field.id)}
              onBlur={(e) => {
                if (document.body.contains(e.target)) {
                  setActiveFieldId(null);
                }
              }}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="absolute inset-0 w-full h-full p-2 focus:ring-2 focus:ring-indigo-500"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textAlign: 'inherit',
                fontWeight: 'inherit',
                fontStyle: 'inherit',
                textDecoration: 'inherit',
              }}
              required={field.required}
            >
              <option value="">-- Select --</option>
              {field.options?.map((opt, index) => (
                <option key={`${opt}-${index}`} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          
          {field.type === 'checkbox' && (
            <label className="flex items-center space-x-2 h-full">
              <input
                type="checkbox"
                checked={formData[field.name] || false}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                required={field.required}
              />
              <span className="text-sm text-slate-700">Yes</span>
            </label>
          )}

          {field.type === 'signature' && (
            <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 transition-colors">
              <span className="text-sm">Click to sign</span>
            </div>
          )}

          {field.type === 'system-serial' && (
            <div className="absolute inset-0 border border-slate-200 rounded-md bg-slate-50 flex items-center px-3 text-slate-500 font-mono italic">
              {generateSerialNumber(selectedTemplate.prefix)}
            </div>
          )}

          {field.type === 'system-date' && (
            <div className="absolute inset-0 border border-slate-200 rounded-md bg-slate-50 flex items-center px-3 text-slate-500 font-mono">
              {new Date().toLocaleDateString()}
            </div>
          )}

          {field.type === 'client' && (
            <div className="w-full min-h-full flex flex-col">
              <select
                value={formData[field.name]?.id || ''}
                onChange={(e) => {
                  const selectedClient = clients.find(c => c.id === e.target.value);
                  setFormData({ ...formData, [field.name]: selectedClient || null });
                }}
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 bg-white mb-2 print:hidden"
                required={field.required}
              >
                <option value="">-- Select Client --</option>
                {clients.map((c, index) => (
                  <option key={c.id || index} value={c.id}>{c.name}</option>
                ))}
              </select>
              {formData[field.name] ? (
                <div className="flex-1 border border-slate-200 rounded-md p-3 bg-slate-50 text-sm overflow-y-auto print:border-none print:bg-transparent print:p-0">
                  <div className="font-bold text-slate-800 mb-1">{formData[field.name].name}</div>
                  {formData[field.name].address && <div className="text-slate-600">Address: {formData[field.name].address}</div>}
                  {formData[field.name].contactPerson && <div className="text-slate-600">Attn: {formData[field.name].contactPerson}</div>}
                  {formData[field.name].telPoBox && <div className="text-slate-600">Tel/P.O Box: {formData[field.name].telPoBox}</div>}
                  {formData[field.name].email && <div className="text-slate-600">Email: {formData[field.name].email}</div>}
                  {formData[field.name].trn && <div className="text-slate-600">TRN: {formData[field.name].trn}</div>}
                </div>
              ) : (
                <div className="flex-1 border border-slate-200 rounded-md p-3 bg-slate-50 text-sm text-slate-400 flex items-center justify-center print:hidden">
                  No client selected
                </div>
              )}
            </div>
          )}

          {field.type === 'image' && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
              {field.content ? (
                <img src={field.content} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                  No Image
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/documents')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Document</h1>
            <p className="text-slate-500">Select a template and fill in the details.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => handleSave('Draft')} disabled={!selectedTemplate}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave('Submitted')} disabled={!selectedTemplate}>
            <Send className="w-4 h-4 mr-2" />
            Submit for Approval
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedTemplateId('');
                  setFormData({});
                }}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option key="all" value="All">All Departments</option>
                {departments
                  .filter(d => isAdmin || d.name === profile?.department)
                  .map((dept, index) => (
                    <option key={dept.id || index} value={dept.id}>{dept.name}</option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Select Template <span className="text-red-500">*</span></label>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  const tId = e.target.value;
                  setSelectedTemplateId(tId);
                  setFormData({});
                }}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option key="default" value="">-- Select a Template --</option>
                {filteredTemplates.map((t, index) => (
                  <option key={t.id || index} value={t.id}>{t.name} ({t.prefix}) - Document</option>
                ))}
              </select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Document Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g., ${selectedTemplate.name} - ${profile?.fullName || 'User'}`}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTemplate && selectedTemplate.type === 'document' && (
        <div className="flex flex-col items-center space-y-8 bg-slate-100 p-8 rounded-xl shadow-inner overflow-x-auto">
            <div 
              className="bg-white shadow-lg relative" 
              style={{ width: '210mm', height: `${totalPages * 297}mm` }}
            >
              {/* Pages */}
              <div className="absolute inset-0 z-0 flex flex-col">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div key={i} className="relative overflow-hidden" style={{ width: '210mm', height: '297mm' }}>
                    <Letterhead fullPage>
                      {/* Fixed Fields for this page */}
                      <div className="absolute inset-0 z-10 pointer-events-none">
                          {fixedFields.filter(f => f.pageIndex === i).map(field => 
                              renderField(field, true, i, field.offsetOnPage)
                          )}
                      </div>

                      {/* Safe Area for Flow Fields */}
                      <div 
                          className="absolute z-20" 
                          style={{ 
                              top: HEADER_HEIGHT, 
                              left: 0, 
                              width: '100%', 
                              height: SAFE_HEIGHT, 
                              overflowY: 'hidden' 
                          }}
                          onScroll={(e) => { e.currentTarget.scrollTop = 0; }}
                      >
                          {flowFields.map(field => {
                              const topInsideSafeArea = field.logicalY - (i * SAFE_HEIGHT);
                              const bottomInsideSafeArea = topInsideSafeArea + field.actualH;
                              
                              if (bottomInsideSafeArea > 0 && topInsideSafeArea < SAFE_HEIGHT) {
                                  return renderField(field, false, i, topInsideSafeArea);
                              }
                              return null;
                          })}
                      </div>
                    </Letterhead>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
