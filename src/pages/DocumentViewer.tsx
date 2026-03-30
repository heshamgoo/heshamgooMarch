import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, CheckCircle, XCircle, Download, Printer, History } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { ApprovalLog, DocumentStatus } from '../types';

import { Letterhead } from '../components/Letterhead';

export function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { documents, templates, updateDocumentStatus } = useStore();
  const { profile, isAdmin } = useAuthStore();
  const [comment, setComment] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const document = documents.find(d => d.id === id);
  const template = templates.find(t => t.id === document?.templateId);
  const creatorName = document?.creatorId === profile?.uid ? profile?.fullName : 'User';

  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const PAGE_HEIGHT = 1122.5;
  const HEADER_HEIGHT = 151;
  const FOOTER_HEIGHT = 132;
  const SAFE_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT; // 839.5

  useLayoutEffect(() => {
    let changed = false;
    const newHeights = { ...measuredHeights };
    Object.entries(fieldRefs.current).forEach(([id, el]) => {
      if (el) {
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

  const { totalPages, fixedFields, flowFields } = useMemo(() => {
    if (!template || !template.fields) return { totalPages: 1, fixedFields: [], flowFields: [] };
    
    const rawFlowFields: any[] = [];
    const fixedFields: any[] = [];
    let maxFixedPageIndex = 0;

    template.fields.forEach(field => {
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
  }, [template, measuredHeights]);

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

  const renderField = (field: any, isFixed: boolean, pageIndex: number, topInsideSafeArea: number = 0, index?: number) => {
    const value = document.data[field.name];
    
    return (
      <div 
        key={`${field.id || index}-${pageIndex}-${isFixed ? 'fixed' : 'flow'}`} 
        ref={(el) => {
            // Only assign ref if it's the first time rendering this field (or if it's fixed)
            // to get the true height for pagination calculations.
            if (isFixed || pageIndex === Math.floor(field.logicalY / SAFE_HEIGHT)) {
                fieldRefs.current[field.id] = el;
            }
        }}
        className="absolute flex flex-col"
        style={{
          left: field.x || 0,
          top: isFixed ? field.offsetOnPage : topInsideSafeArea,
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
            className="text-sm font-semibold text-slate-700 flex items-center mb-1 shrink-0 print-hidden"
            data-html2canvas-ignore="true"
          >
            {field.label}
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
              className="w-full h-full border-collapse table-fixed bg-white"
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
                  const rowData = (value || [])[rowIndex] || {};
                  return (
                    <tr key={rowIndex} style={{ height: field.rowHeights?.[rowIndex] || 'auto' }}>
                      {Array.from({ length: field.cols || 2 }).map((_, colIndex) => {
                        if (isCellMerged(field, rowIndex, colIndex)) return null;
                        const cellStyle = getCellStyle(field, rowIndex, colIndex);
                        const colName = field.options?.[colIndex] || `Col ${colIndex + 1}`;
                        return (
                          <td 
                            key={colIndex} 
                            className="px-2 py-1"
                            colSpan={cellStyle?.colSpan || 1}
                            rowSpan={cellStyle?.rowSpan || 1}
                            style={{ 
                              borderColor: field.borderColor || '#cbd5e1',
                              borderWidth: field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px',
                              borderStyle: 'solid',
                              backgroundColor: cellStyle?.backgroundColor || 'transparent',
                              width: cellStyle?.width || 'auto',
                              height: cellStyle?.height || 'auto',
                              color: cellStyle?.color || field.color || 'inherit',
                              fontFamily: field.fontFamily || 'inherit',
                              fontSize: field.fontSize ? `${field.fontSize}px` : 'inherit',
                              textAlign: cellStyle?.align || field.align || 'left',
                              fontWeight: cellStyle?.bold !== undefined ? (cellStyle.bold ? 'bold' : 'normal') : (field.bold ? 'bold' : 'normal'),
                              fontStyle: cellStyle?.italic !== undefined ? (cellStyle.italic ? 'italic' : 'normal') : (field.italic ? 'italic' : 'normal'),
                              textDecoration: cellStyle?.underline !== undefined ? (cellStyle.underline ? 'underline' : 'none') : (field.underline ? 'underline' : 'none'),
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {rowData[colName] || ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {field.type === 'signature' && (
            <div className="absolute inset-0 border-b-2 border-slate-800 flex items-end justify-center pb-2 bg-white">
              {value ? (
                <span className="font-signature text-2xl text-slate-800">{value}</span>
              ) : (
                <span className="text-slate-300 italic text-sm">Not signed</span>
              )}
            </div>
          )}

          {field.type === 'system-serial' && (
            <div className="absolute inset-0 w-full h-full p-2 text-sm bg-transparent font-mono flex items-center">
              {document.serialNumber}
            </div>
          )}

          {field.type === 'system-date' && (
            <div className="absolute inset-0 w-full h-full p-2 text-sm bg-transparent font-mono flex items-center">
              {format(new Date(document.createdAt), 'dd/MM/yyyy')}
            </div>
          )}

          {field.type === 'image' && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
              {field.content && (
                <img src={field.content} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              )}
            </div>
          )}

          {field.type === 'client' && value && (
            <div className="w-full min-h-full p-2 text-sm bg-transparent overflow-visible flex flex-col">
              <div className="font-bold text-slate-800 mb-1">{value.name}</div>
              {value.address && <div className="text-slate-600">Address: {value.address}</div>}
              {value.contactPerson && <div className="text-slate-600">Attn: {value.contactPerson}</div>}
              {value.telPoBox && <div className="text-slate-600">Tel/P.O Box: {value.telPoBox}</div>}
              {value.email && <div className="text-slate-600">Email: {value.email}</div>}
              {value.trn && <div className="text-slate-600">TRN: {value.trn}</div>}
            </div>
          )}

          {field.type !== 'static-text' && field.type !== 'table' && field.type !== 'signature' && field.type !== 'system-serial' && field.type !== 'system-date' && field.type !== 'image' && field.type !== 'client' && (
            <div className="w-full min-h-full p-2 text-sm bg-transparent break-words whitespace-pre-wrap" style={{ textAlign: 'inherit' }}>
              {field.type === 'checkbox' ? (value ? 'Yes' : 'No') : (value || '')}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!document || !template) {
    return <div className="p-6 text-red-500">Document not found.</div>;
  }

  const canApprove = () => {
    if (!profile) return false;
    if (document.status === 'Submitted' && profile.role === 'Manager') return true;
    if (document.status === 'Approved Level 1' && profile.role === 'Admin') return true;
    if (isAdmin && ['Submitted', 'Approved Level 1'].includes(document.status)) return true;
    return false;
  };

  const handleAction = async (action: 'Approved' | 'Rejected') => {
    if (!profile) return;
    
    let newStatus: DocumentStatus = document.status;
    let level = 1;

    if (action === 'Rejected') {
      newStatus = 'Rejected';
    } else {
      if (document.status === 'Submitted') {
        newStatus = 'Approved Level 1';
        level = 1;
      } else if (document.status === 'Approved Level 1') {
        newStatus = 'Final Approved';
        level = 2;
      }
    }

    const log: ApprovalLog = {
      id: `l${Date.now()}`,
      userId: profile.uid,
      action,
      comments: comment,
      timestamp: new Date().toISOString(),
      level
    };

    try {
      await updateDocumentStatus(document.id, newStatus, log);
      setComment('');
    } catch (error) {
      console.error('Failed to update document status:', error);
      alert('Failed to update document status. Please try again.');
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const pages = printRef.current.children;
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const dataUrl = await htmlToImage.toPng(pageEl, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left'
          },
          filter: (node) => {
            if (node instanceof HTMLElement) {
              return node.getAttribute('data-html2canvas-ignore') !== 'true';
            }
            return true;
          }
        });
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`${document.serialNumber}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Failed to generate PDF. Please try using the Print button instead.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none print:bg-white">
      <div className="flex items-center justify-between print-hidden">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/documents')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{document.serialNumber}</h1>
            <p className="text-slate-500">{document.title}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:w-full">
        <div className="lg:col-span-2 space-y-6 print:w-full">
          <div className="mx-auto flex flex-col items-center space-y-8 overflow-x-auto print:overflow-visible print:block print:p-0 print:space-y-0">
            <div ref={printRef} className="flex flex-col space-y-8 print:space-y-0 print:block">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div 
                  key={i}
                  className="bg-white shadow-lg print:shadow-none print:m-0 relative overflow-hidden"
                  style={{ 
                    width: '210mm', 
                    height: '297mm',
                    pageBreakAfter: i < totalPages - 1 ? 'always' : 'auto'
                  }}
                >
                  <Letterhead fullPage>
                    <div className="relative w-full h-full flex-1">
                        {/* Render Fixed Fields for this page */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            {fixedFields.filter(f => f.pageIndex === i).map((field, idx) => renderField(field, true, i, 0, idx))}
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
                        >
                            {flowFields.map((field, idx) => {
                                const topInsideSafeArea = field.logicalY - (i * SAFE_HEIGHT);
                                const bottomInsideSafeArea = topInsideSafeArea + field.actualH;
                                
                                if (bottomInsideSafeArea > 0 && topInsideSafeArea < SAFE_HEIGHT) {
                                    return renderField(field, false, i, topInsideSafeArea, idx);
                                }
                                return null;
                            })}
                        </div>
                    </div>
                  </Letterhead>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 print-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Status & Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-3">
                <span className={cn(
                  "px-3 py-1 text-sm font-medium rounded-full",
                  document.status === 'Final Approved' ? 'bg-emerald-100 text-emerald-700' :
                  document.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                  document.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                )}>
                  {document.status}
                </span>
              </div>

              {canApprove() && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Add Comment (Optional)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 h-20"
                      placeholder="Reason for approval/rejection..."
                    />
                  </div>
                  <div className="flex space-x-3">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction('Approved')}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={() => handleAction('Rejected')}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
