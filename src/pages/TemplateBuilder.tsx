import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from '../components/ui/Button';
import { Template, TemplateField, FieldType, TableCellStyle } from '../types';
import { Trash2, Save, ArrowLeft, Type, AlignLeft, Hash, Calendar, ChevronDown, CheckSquare, PenTool, Table as TableIcon, Settings, Plus, Image as ImageIcon, Users, Grid, Info } from 'lucide-react';
import { cn } from '../utils/cn';
import { clsx } from 'clsx';
import { Letterhead } from '../components/Letterhead';
import { Rnd } from 'react-rnd';
import { useCollaboration } from '../store/useCollaboration';

const TOOLBOX_ITEMS = [
  { type: 'static-text', label: 'Static Text', icon: AlignLeft },
  { type: 'text', label: 'Short Text', icon: Type },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'table', label: 'Table', icon: TableIcon },
  { type: 'signature', label: 'Signature', icon: PenTool },
  { type: 'system-serial', label: 'Serial Number', icon: Hash },
  { type: 'system-date', label: 'Current Date', icon: Calendar },
  { type: 'client', label: 'Client Details', icon: Users },
  { type: 'image', label: 'Image/Logo', icon: ImageIcon },
];

export function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates, departments, addTemplate, updateTemplate, loading: storeLoading } = useStore();
  const { profile, isLoading: authLoading } = useAuthStore();
  const { settings } = useSettingsStore();

  const isNew = !id;
  const existingTemplate = templates.find((t) => t.id === id);

  const depts = departments;

  console.log('TemplateBuilder state:', { id, isNew, templatesCount: templates.length, storeLoading, authLoading });

  const [template, setTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    prefix: 'DOC',
    departmentId: '',
    fields: [],
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ fieldId: string, startRow: number, startCol: number, endRow: number, endCol: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (selectionRange && selectionRange.fieldId !== selectedFieldId) {
      setSelectionRange(null);
    }
  }, [selectedFieldId, selectionRange]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const pages = useMemo(() => {
    if (!template || !template.fields) return [];
    const PAGE_HEIGHT = 1122.5;

    // Determine the maximum Y to know how many pages we need
    let maxY = 0;
    template.fields.forEach(field => {
      const y = Number(field.y) || 0;
      const h = Number(field.h) || 60;
      if (y + h > maxY) {
        maxY = y + h;
      }
    });

    const totalPages = Math.max(1, Math.ceil(maxY / PAGE_HEIGHT));
    const resultPages: { fields: (any & { newY: number })[] }[] = Array.from({ length: totalPages }, () => ({ fields: [] }));

    template.fields.forEach(field => {
      const y = Number(field.y) || 0;
      const pageIndex = Math.floor(y / PAGE_HEIGHT);
      const safePageIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
      
      const newY = y - (safePageIndex * PAGE_HEIGHT);

      resultPages[safePageIndex].fields.push({
        ...field,
        newY
      });
    });

    return resultPages;
  }, [template]);

  const { collaborators, sharedData, updateSharedData } = useCollaboration(
    isNew ? 'new-template' : `template-${id}`,
    template
  );

  useEffect(() => {
    if (sharedData && sharedData !== template) {
      setTemplate(sharedData);
    }
  }, [sharedData]);

  const updateTemplateState = (updater: (prev: Partial<Template>) => Partial<Template> | Partial<Template>) => {
    setTemplate((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      updateSharedData(next);
      return next;
    });
  };

  useEffect(() => {
    if (existingTemplate && !isNew) {
      setTemplate(existingTemplate);
      updateSharedData(existingTemplate);
    } else if (isNew && departments.length > 0 && profile?.department && !template.departmentId) {
      const userDeptId = departments.find(d => d.id === profile.department || d.name === profile.department)?.id || profile.department;
      if (userDeptId) {
        updateTemplateState(prev => ({ ...prev, departmentId: userDeptId }));
      }
    }
  }, [existingTemplate, isNew, departments, profile?.department]);

  const handleSave = async () => {
    setSaveError(null);
    console.log('handleSave triggered', { template, isNew, existingTemplate });
    if (!template.name || !template.prefix) {
      const msg = 'Name and Prefix are required.';
      console.warn(msg);
      setSaveError(msg);
      return;
    }

    const creatorId = profile?.uid || 'system';
    console.log('Creator ID:', creatorId);

    const newTemplate: Template = {
      id: isNew ? `t${Date.now()}` : (existingTemplate?.id || id!),
      name: template.name!,
      description: template.description || '',
      prefix: template.prefix!,
      type: 'document',
      departmentId: template.departmentId || '',
      fields: template.fields || [],
      headerContent: template.headerContent || '',
      footerContent: template.footerContent || '',
      bodyContent: '',
      createdAt: (isNew || !existingTemplate) ? new Date().toISOString() : existingTemplate.createdAt,
      updatedAt: new Date().toISOString(),
      createdBy: (isNew || !existingTemplate) ? creatorId : existingTemplate.createdBy,
    };

    console.log('Template object to save:', newTemplate);
    setIsSaving(true);

    try {
      if (isNew || !existingTemplate) {
        console.log('Calling addTemplate');
        await addTemplate(newTemplate);
      } else {
        console.log('Calling updateTemplate');
        await updateTemplate(newTemplate.id, newTemplate);
      }
      console.log('Save successful, navigating...');
      navigate('/templates');
    } catch (error: any) {
      console.error('Failed to save template:', error);
      setIsSaving(false);
      
      let errorMessage = error.message || 'Failed to save template';
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not a JSON error
      }
      
      setSaveError(errorMessage);
    }
  };

  const getCellStyle = (field: TemplateField, row: number, col: number) => {
    return field.cellStyles?.find(s => s.row === row && s.col === col);
  };

  const isCellMerged = (field: TemplateField, row: number, col: number) => {
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

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  };

  const updateCellStyle = (fieldId: string, row: number, col: number, updates: Partial<TableCellStyle>) => {
    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.map((f) => {
        if (f.id !== fieldId) return f;
        const existingStyles = f.cellStyles || [];
        const existingStyleIndex = existingStyles.findIndex(s => s.row === row && s.col === col);
        
        let newStyles = [...existingStyles];
        if (existingStyleIndex >= 0) {
          newStyles[existingStyleIndex] = { ...newStyles[existingStyleIndex], ...updates };
        } else {
          newStyles.push({ row, col, ...updates });
        }
        return { ...f, cellStyles: newStyles };
      }),
    }));
  };

  const updateSelectionStyle = (updates: Partial<TableCellStyle>) => {
    if (!selectionRange) return;
    const { fieldId, startRow, startCol, endRow, endCol } = selectionRange;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.map((f) => {
        if (f.id !== fieldId) return f;
        let newStyles = [...(f.cellStyles || [])];
        
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const idx = newStyles.findIndex(s => s.row === r && s.col === c);
            if (idx >= 0) {
              newStyles[idx] = { ...newStyles[idx], ...updates };
            } else {
              newStyles.push({ row: r, col: c, ...updates });
            }
          }
        }
        return { ...f, cellStyles: newStyles };
      }),
    }));
  };

  const mergeSelection = (type: 'all' | 'horizontal' | 'vertical') => {
    if (!selectionRange) return;
    const { fieldId, startRow, startCol, endRow, endCol } = selectionRange;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    if (minRow === maxRow && minCol === maxCol) return;

    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.map((f) => {
        if (f.id !== fieldId) return f;
        let newStyles = [...(f.cellStyles || [])];

        if (type === 'all') {
          // Remove styles for all cells in range except top-left
          newStyles = newStyles.filter(s => 
            s.row < minRow || s.row > maxRow || s.col < minCol || s.col > maxCol || (s.row === minRow && s.col === minCol)
          );
          const idx = newStyles.findIndex(s => s.row === minRow && s.col === minCol);
          const updates = { colSpan: maxCol - minCol + 1, rowSpan: maxRow - minRow + 1 };
          if (idx >= 0) {
            newStyles[idx] = { ...newStyles[idx], ...updates };
          } else {
            newStyles.push({ row: minRow, col: minCol, ...updates });
          }
        } else if (type === 'horizontal') {
          for (let r = minRow; r <= maxRow; r++) {
            newStyles = newStyles.filter(s => 
              s.row !== r || s.col < minCol || s.col > maxCol || s.col === minCol
            );
            const idx = newStyles.findIndex(s => s.row === r && s.col === minCol);
            const updates = { colSpan: maxCol - minCol + 1, rowSpan: 1 };
            if (idx >= 0) {
              newStyles[idx] = { ...newStyles[idx], ...updates };
            } else {
              newStyles.push({ row: r, col: minCol, ...updates });
            }
          }
        } else if (type === 'vertical') {
          for (let c = minCol; c <= maxCol; c++) {
            newStyles = newStyles.filter(s => 
              s.col !== c || s.row < minRow || s.row > maxRow || s.row === minRow
            );
            const idx = newStyles.findIndex(s => s.row === minRow && s.col === c);
            const updates = { rowSpan: maxRow - minRow + 1, colSpan: 1 };
            if (idx >= 0) {
              newStyles[idx] = { ...newStyles[idx], ...updates };
            } else {
              newStyles.push({ row: minRow, col: c, ...updates });
            }
          }
        }
        return { ...f, cellStyles: newStyles };
      }),
    }));
  };

  const unmergeSelection = () => {
    if (!selectionRange) return;
    const { fieldId, startRow, startCol, endRow, endCol } = selectionRange;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.map((f) => {
        if (f.id !== fieldId) return f;
        let newStyles = (f.cellStyles || []).map(s => {
          if (s.row >= minRow && s.row <= maxRow && s.col >= minCol && s.col <= maxCol) {
            return { ...s, colSpan: 1, rowSpan: 1 };
          }
          return s;
        });
        return { ...f, cellStyles: newStyles };
      }),
    }));
  };

  const removeField = (id: string) => {
    updateTemplateState((prev) => ({
      ...prev,
      fields: prev.fields?.filter((f) => f.id !== id),
    }));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const addField = (type: FieldType, x: number, y: number) => {
    const newField: TemplateField = {
      id: `f${Date.now()}`,
      name: `${type}_${Date.now()}`,
      label: `New ${TOOLBOX_ITEMS.find(i => i.type === type)?.label}`,
      type,
      required: false,
      x,
      y,
      w: type === 'table' ? 400 : 200,
      h: type === 'table' ? 150 : type === 'textarea' ? 100 : 60,
    };

    if (type === 'static-text') newField.content = 'Enter your text here...';
    if (type === 'dropdown') newField.options = ['Option 1'];
    if (type === 'table') {
      newField.options = ['Column 1', 'Column 2'];
      newField.rows = 3;
      newField.cols = 2;
    }
    
    updateTemplateState(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }));
    setSelectedFieldId(newField.id);
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('type', type);
  };

  if (storeLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Template Builder...</p>
        </div>
      </div>
    );
  }

  if (!isNew && !existingTemplate) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Template not found</h2>
        <Button onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    );
  }

  const selectedField = template.fields?.find(f => f.id === selectedFieldId);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-slate-100 -m-6">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/templates')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={template.name}
              onChange={(e) => updateTemplateState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Template Name"
              className="text-lg font-bold border-none focus:ring-0 p-0 bg-transparent placeholder:text-slate-400 w-64"
            />
            <div className="h-6 w-px bg-slate-300"></div>
            <select
              value={template.departmentId || ''}
              onChange={(e) => updateTemplateState((prev) => ({ ...prev, departmentId: e.target.value }))}
              className="text-sm font-medium border-none focus:ring-0 p-0 bg-transparent text-slate-600 cursor-pointer"
            >
              <option key="default" value="">Select Department</option>
              {depts.map((dept, index) => (
                <option key={dept.id || index} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            <div className="h-6 w-px bg-slate-300"></div>
            <input
              type="text"
              value={template.prefix}
              onChange={(e) => updateTemplateState((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
              placeholder="PREFIX"
              className="text-sm font-medium border-none focus:ring-0 p-0 bg-transparent placeholder:text-slate-400 w-32 uppercase"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-2 mr-4">
              {collaborators.map((c, index) => (
                <div 
                  key={c.uid || index} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <div className="text-xs text-slate-500 ml-4 font-medium">
                {collaborators.length} online
              </div>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-1 rounded-md text-xs animate-pulse max-w-xs truncate">
              {saveError}
            </div>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center">
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>

      <div 
        className="flex flex-1 overflow-hidden"
        onMouseUp={() => setIsSelecting(false)}
      >
        {/* Left Sidebar - Toolbox */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-700 flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Elements
          </div>
          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            <p className="text-xs text-slate-500 mb-4">Drag elements to the canvas</p>
            {TOOLBOX_ITEMS.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => handleDragStart(e, item.type)}
                className="flex items-center p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-grab hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
              >
                <item.icon className="w-4 h-4 mr-3 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center - A4 Canvas */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex flex-col items-center space-y-8 relative">
          {collaborators.map((c, index) => c.cursor && (
            <div 
              key={c.uid || index}
              className="fixed pointer-events-none z-50 flex flex-col items-center"
              style={{ left: c.cursor.x, top: c.cursor.y, transition: 'all 0.1s ease' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 14.5L14.5 8.5L2.5 2.5V14.5Z" fill={c.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <div 
                className="px-2 py-1 rounded text-xs text-white font-medium whitespace-nowrap mt-1 shadow-sm"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </div>
            </div>
          ))}

          {pages.map((page, pageIndex) => (
            <div key={pageIndex} className="bg-white shadow-2xl relative overflow-hidden" style={{ width: '210mm', height: '297mm' }}>
              <Letterhead fullPage>
                <div 
                  className="relative w-full h-full"
                  ref={pageIndex === 0 ? canvasRef : null}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const type = e.dataTransfer.getData('type');
                    if (type && canvasRef.current) {
                      const rect = canvasRef.current.getBoundingClientRect();
                      const yOffset = pageIndex * 1122.5;
                      const newField: TemplateField = {
                        id: crypto.randomUUID(),
                        type: type as any,
                        label: `New ${type}`,
                        name: `field_${Date.now()}`,
                        required: false,
                        x: Math.max(0, e.clientX - rect.left),
                        y: Math.max(0, e.clientY - rect.top + yOffset),
                        w: type === 'table' ? 400 : 200,
                        h: type === 'table' ? 150 : type === 'textarea' ? 100 : 60,
                        bold: false,
                        align: 'left',
                        color: '#1e293b',
                        content: type === 'static-text' ? 'Double click to edit text' : '',
                        cols: type === 'table' ? 2 : undefined,
                        rows: type === 'table' ? 2 : undefined,
                      };
                      
                      const newFields = [...(template.fields || []), newField];
                      setTemplate({ ...template, fields: newFields });
                      updateSharedData({ ...template, fields: newFields });
                      setSelectedFieldId(newField.id);
                    }
                  }}
                  onClick={() => setSelectedFieldId(null)}
                >
                  {page.fields.map((field, index) => (
                    <Rnd
                      key={field.id || index}
                      size={{ width: field.w || 200, height: field.h || 60 }}
                      position={{ x: field.x || 0, y: field.newY }}
                      onDragStop={(e, d) => {
                        const yOffset = pageIndex * 1122.5;
                        updateField(field.id, { x: d.x, y: d.y + yOffset });
                      }}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        const yOffset = pageIndex * 1122.5;
                        updateField(field.id, {
                          w: parseInt(ref.style.width),
                          h: parseInt(ref.style.height),
                          x: position.x,
                          y: position.y + yOffset,
                        });
                      }}
                      bounds="parent"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                      }}
                      className={cn(
                        "group rounded-lg border-2 transition-colors bg-white/80 backdrop-blur-sm",
                        selectedFieldId === field.id ? "border-indigo-500 shadow-md z-20" : "border-transparent hover:border-slate-300 z-10"
                      )}
                  >
                    <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }} 
                        className="p-1.5 bg-white shadow-md border border-slate-200 rounded-full cursor-pointer text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className={cn(
                      "w-full min-h-full overflow-visible p-2 flex flex-col",
                      field.type !== 'table' && "pointer-events-none"
                    )} style={{
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
                    }}>
                      {field.type === 'static-text' ? (
                        <textarea
                          value={field.content || 'Empty text block'}
                          onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                            updateField(field.id, { content: e.target.value });
                          }}
                          className="w-full min-h-full bg-transparent border-none focus:ring-0 resize-none p-0 m-0 overflow-hidden pointer-events-auto"
                          style={{ textAlign: 'inherit' }}
                          placeholder="Enter text here..."
                        />
                      ) : (
                        <div className="flex flex-col h-full">
                          <label className="text-sm font-semibold text-slate-700 flex items-center mb-1 shrink-0">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          
                          <div className="flex-1 w-full relative">
                            {field.type === 'text' && <div className="absolute inset-0 bg-transparent"></div>}
                            {field.type === 'textarea' && <div className="absolute inset-0 bg-transparent"></div>}
                            {field.type === 'number' && <div className="absolute inset-0 bg-transparent flex items-center px-3 text-slate-400">123</div>}
                            {field.type === 'date' && <div className="absolute inset-0 bg-transparent flex items-center px-3 text-slate-400"><Calendar className="w-4 h-4 mr-2"/> dd/mm/yyyy</div>}
                            {field.type === 'dropdown' && <div className="absolute inset-0 bg-transparent flex items-center justify-between px-3 text-slate-400"><span>Select option...</span><ChevronDown className="w-4 h-4"/></div>}
                            {field.type === 'checkbox' && <div className="flex items-center space-x-2 h-full"><div className="w-4 h-4 border border-slate-300 rounded bg-white"></div><span className="text-sm text-slate-500">Checkbox option</span></div>}
                            {field.type === 'signature' && <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-md bg-slate-50 flex items-center justify-center text-slate-400"><PenTool className="w-6 h-6 mb-2 opacity-50"/></div>}
                            {field.type === 'system-serial' && <div className="absolute inset-0 bg-transparent flex items-center px-3 text-slate-500 font-mono">{template.prefix || 'PREFIX'}-{new Date().getFullYear()}-0001</div>}
                            {field.type === 'system-date' && <div className="absolute inset-0 bg-transparent flex items-center px-3 text-slate-500 font-mono">{new Date().toLocaleDateString()}</div>}
                            {field.type === 'client' && (
                              <div className="absolute inset-0 bg-transparent flex flex-col justify-center px-3 text-slate-500 text-xs space-y-1">
                                <div className="font-bold text-slate-700">Client Name</div>
                                <div>Address, TRN, Contact...</div>
                              </div>
                            )}
                            {field.type === 'image' && (
                              <div className="absolute inset-0 border-2 border-dashed border-slate-300 rounded-md bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon className="w-8 h-8 mb-1 opacity-50"/>
                                <span className="text-[10px]">Image Placeholder</span>
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
                                    {Array.from({ length: field.cols || 2 }).map((_, colIndex) => {
                                      const rowIndex = -1;
                                      if (isCellMerged(field, rowIndex, colIndex)) return null;
                                      const cellStyle = getCellStyle(field, rowIndex, colIndex);
                                      
                                      const isSelected = selectionRange?.fieldId === field.id && 
                                        rowIndex >= Math.min(selectionRange.startRow, selectionRange.endRow) &&
                                        rowIndex <= Math.max(selectionRange.startRow, selectionRange.endRow) &&
                                        colIndex >= Math.min(selectionRange.startCol, selectionRange.endCol) &&
                                        colIndex <= Math.max(selectionRange.startCol, selectionRange.endCol);

                                      return (
                                        <th 
                                          key={colIndex} 
                                          className={cn(
                                            "px-2 py-1 cursor-pointer transition-all relative border border-slate-300",
                                            isSelected && "ring-2 ring-indigo-600 ring-inset bg-indigo-100/40 z-10 shadow-sm",
                                            !isSelected && "hover:bg-slate-100"
                                          )}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setSelectedFieldId(field.id);
                                            setSelectionRange({ 
                                              fieldId: field.id, 
                                              startRow: rowIndex, 
                                              startCol: colIndex,
                                              endRow: rowIndex,
                                              endCol: colIndex
                                            });
                                            setIsSelecting(true);
                                          }}
                                          onMouseEnter={() => {
                                            if (isSelecting && selectionRange) {
                                              setSelectionRange({
                                                ...selectionRange,
                                                endRow: rowIndex,
                                                endCol: colIndex
                                              });
                                            }
                                          }}
                                          onMouseUp={() => setIsSelecting(false)}
                                          colSpan={cellStyle?.colSpan || 1}
                                          rowSpan={cellStyle?.rowSpan || 1}
                                          style={{ 
                                            borderColor: cellStyle?.borderColor || field.borderColor || '#cbd5e1',
                                            borderWidth: cellStyle?.borderWidth !== undefined ? `${cellStyle.borderWidth}px` : (field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px'),
                                            borderStyle: cellStyle?.borderStyle || 'solid',
                                            backgroundColor: cellStyle?.backgroundColor || 'transparent',
                                            color: cellStyle?.color || field.color || 'inherit',
                                            textAlign: cellStyle?.align || field.align || 'left',
                                            verticalAlign: cellStyle?.verticalAlign || 'middle',
                                            fontWeight: cellStyle?.bold !== undefined ? (cellStyle.bold ? 'bold' : 'normal') : (field.bold ? 'bold' : 'normal'),
                                            fontStyle: cellStyle?.italic !== undefined ? (cellStyle.italic ? 'italic' : 'normal') : (field.italic ? 'italic' : 'normal'),
                                            textDecoration: cellStyle?.underline !== undefined ? (cellStyle.underline ? 'underline' : 'none') : (field.underline ? 'underline' : 'none'),
                                            fontSize: cellStyle?.fontSize ? `${cellStyle.fontSize}px` : 'inherit',
                                            width: cellStyle?.width || 'auto',
                                            height: cellStyle?.height || 'auto',
                                          }}
                                        >
                                          {field.options?.[colIndex] || `Col ${colIndex + 1}`}
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: field.rows || 2 }).map((_, rowIndex) => (
                                    <tr key={rowIndex} style={{ height: field.rowHeights?.[rowIndex] || 'auto' }}>
                                      {Array.from({ length: field.cols || 2 }).map((_, colIndex) => {
                                        if (isCellMerged(field, rowIndex, colIndex)) return null;
                                        const cellStyle = getCellStyle(field, rowIndex, colIndex);
                                        
                                        const isSelected = selectionRange?.fieldId === field.id && 
                                          rowIndex >= Math.min(selectionRange.startRow, selectionRange.endRow) &&
                                          rowIndex <= Math.max(selectionRange.startRow, selectionRange.endRow) &&
                                          colIndex >= Math.min(selectionRange.startCol, selectionRange.endCol) &&
                                          colIndex <= Math.max(selectionRange.startCol, selectionRange.endCol);

                                        return (
                                          <td 
                                            key={colIndex} 
                                              className={cn(
                                                "px-2 py-1 cursor-pointer transition-all relative border border-slate-200",
                                                isSelected && "ring-2 ring-indigo-600 ring-inset bg-indigo-100/40 z-10 shadow-sm",
                                                !isSelected && "hover:bg-slate-50"
                                              )}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setSelectedFieldId(field.id);
                                              setSelectionRange({ 
                                                fieldId: field.id, 
                                                startRow: rowIndex, 
                                                startCol: colIndex,
                                                endRow: rowIndex,
                                                endCol: colIndex
                                              });
                                              setIsSelecting(true);
                                            }}
                                            onMouseEnter={() => {
                                              if (isSelecting && selectionRange) {
                                                setSelectionRange({
                                                  ...selectionRange,
                                                  endRow: rowIndex,
                                                  endCol: colIndex
                                                });
                                              }
                                            }}
                                            onMouseUp={() => setIsSelecting(false)}
                                            colSpan={cellStyle?.colSpan || 1}
                                            rowSpan={cellStyle?.rowSpan || 1}
                                            style={{ 
                                              borderColor: cellStyle?.borderColor || field.borderColor || '#cbd5e1',
                                              borderWidth: cellStyle?.borderWidth !== undefined ? `${cellStyle.borderWidth}px` : (field.borderWidth !== undefined ? `${field.borderWidth}px` : '1px'),
                                              borderStyle: cellStyle?.borderStyle || 'solid',
                                              backgroundColor: cellStyle?.backgroundColor || 'transparent',
                                              color: cellStyle?.color || 'inherit',
                                              textAlign: cellStyle?.align || 'left',
                                              verticalAlign: cellStyle?.verticalAlign || 'middle',
                                              fontWeight: cellStyle?.bold ? 'bold' : 'normal',
                                              fontStyle: cellStyle?.italic ? 'italic' : 'normal',
                                              textDecoration: cellStyle?.underline ? 'underline' : 'none',
                                              fontSize: cellStyle?.fontSize ? `${cellStyle.fontSize}px` : 'inherit',
                                              width: cellStyle?.width || 'auto',
                                              height: cellStyle?.height || 'auto',
                                            }}
                                          >
                                            <div className="min-h-[1.5rem] w-full"></div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Rnd>
                ))}

                {pageIndex === 0 && template.fields?.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl pointer-events-none">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Plus className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-500">Drag and drop elements here</p>
                    <p className="text-sm">Build your document template visually</p>
                  </div>
                )}
              </div>
            </Letterhead>
          </div>
        ))}
      </div>

      {/* Right Sidebar - Properties */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-10">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-700 flex items-center">
            <Settings className="w-4 h-4 mr-2" /> Properties
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {selectedField ? (
              <div className="space-y-6">
                {selectedField.type === 'static-text' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Text Content</label>
                    <textarea
                      value={selectedField.content || ''}
                      onChange={(e) => updateField(selectedField.id, { content: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                      placeholder="Enter text here..."
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Field Label</label>
                      <input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Variable Name</label>
                      <input
                        type="text"
                        value={selectedField.name}
                        onChange={(e) => updateField(selectedField.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-500">Used for data export and API</p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="required-toggle"
                        checked={selectedField.required}
                        onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <label htmlFor="required-toggle" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Required Field
                      </label>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <label className="text-sm font-medium text-slate-700">Text Formatting</label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Font Family</label>
                          <select
                            value={selectedField.fontFamily || 'inherit'}
                            onChange={(e) => updateField(selectedField.id, { fontFamily: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="inherit">Default</option>
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                            <option value="'Courier New', monospace">Courier New</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="Verdana, sans-serif">Verdana</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Font Size (px)</label>
                          <input
                            type="number"
                            value={selectedField.fontSize || ''}
                            onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) || undefined })}
                            placeholder="Default"
                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          onClick={() => updateField(selectedField.id, { bold: !selectedField.bold })}
                          className={cn(
                            "p-2 border rounded-md transition-colors w-10 h-10 flex items-center justify-center",
                            selectedField.bold ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-300 text-slate-600"
                          )}
                          title="Bold"
                        >
                          <span className="font-bold">B</span>
                        </button>
                        <button
                          onClick={() => updateField(selectedField.id, { italic: !selectedField.italic })}
                          className={cn(
                            "p-2 border rounded-md transition-colors w-10 h-10 flex items-center justify-center",
                            selectedField.italic ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-300 text-slate-600"
                          )}
                          title="Italic"
                        >
                          <span className="italic font-serif">I</span>
                        </button>
                        <button
                          onClick={() => updateField(selectedField.id, { underline: !selectedField.underline })}
                          className={cn(
                            "p-2 border rounded-md transition-colors w-10 h-10 flex items-center justify-center",
                            selectedField.underline ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-300 text-slate-600"
                          )}
                          title="Underline"
                        >
                          <span className="underline">U</span>
                        </button>

                        <div className="flex border border-slate-300 rounded-md overflow-hidden h-10">
                          {(['left', 'center', 'right'] as const).map((align) => (
                            <button
                              key={align}
                              onClick={() => updateField(selectedField.id, { align })}
                              className={cn(
                                "p-2 transition-colors border-r last:border-r-0 flex flex-col items-center justify-center w-10",
                                selectedField.align === align || (!selectedField.align && align === 'left')
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-white text-slate-600"
                              )}
                              title={`Align ${align}`}
                            >
                              <div className={cn(
                                "w-4 h-0.5 bg-current mb-0.5",
                                align === 'left' ? "mr-auto ml-0" : align === 'right' ? "ml-auto mr-0" : "mx-auto"
                              )}></div>
                              <div className="w-3 h-0.5 bg-current mb-0.5 mx-auto"></div>
                              <div className={cn(
                                "w-4 h-0.5 bg-current",
                                align === 'left' ? "mr-auto ml-0" : align === 'right' ? "ml-auto mr-0" : "mx-auto"
                              )}></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <label className="text-sm font-medium text-slate-700">Appearance</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Text Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={selectedField.color || '#000000'}
                              onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                              className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                            />
                            <input 
                              type="text" 
                              value={selectedField.color || '#000000'} 
                              onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                              className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Background</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={selectedField.backgroundColor || '#ffffff'}
                              onChange={(e) => updateField(selectedField.id, { backgroundColor: e.target.value })}
                              className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                            />
                            <input 
                              type="text" 
                              value={selectedField.backgroundColor || 'transparent'} 
                              onChange={(e) => updateField(selectedField.id, { backgroundColor: e.target.value })}
                              className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Border Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={selectedField.borderColor || '#e2e8f0'}
                              onChange={(e) => updateField(selectedField.id, { borderColor: e.target.value })}
                              className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                            />
                            <input 
                              type="text" 
                              value={selectedField.borderColor || 'transparent'} 
                              onChange={(e) => updateField(selectedField.id, { borderColor: e.target.value })}
                              className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Border Width (px)</label>
                          <input
                            type="number"
                            min="0"
                            value={selectedField.borderWidth !== undefined ? selectedField.borderWidth : ''}
                            onChange={(e) => updateField(selectedField.id, { borderWidth: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Border Radius (px)</label>
                          <input
                            type="number"
                            min="0"
                            value={selectedField.borderRadius !== undefined ? selectedField.borderRadius : ''}
                            onChange={(e) => updateField(selectedField.id, { borderRadius: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {selectedField.type === 'table' && (
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Rows</label>
                            <input
                              type="number"
                              min="1"
                              value={selectedField.rows || 2}
                              onChange={(e) => updateField(selectedField.id, { rows: parseInt(e.target.value) || 1 })}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Columns</label>
                            <input
                              type="number"
                              min="1"
                              value={selectedField.cols || 2}
                              onChange={(e) => updateField(selectedField.id, { cols: parseInt(e.target.value) || 1 })}
                              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Column Headers (comma separated)</label>
                          <textarea
                            value={selectedField.options?.join(', ') || ''}
                            onChange={(e) => updateField(selectedField.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 h-16"
                            placeholder="Item, Quantity, Price"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Column Widths (comma separated)</label>
                          <input
                            type="text"
                            value={selectedField.colWidths?.join(', ') || ''}
                            onChange={(e) => updateField(selectedField.id, { colWidths: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g., 50px, 1fr, 20%"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Row Heights (comma separated)</label>
                          <input
                            type="text"
                            value={selectedField.rowHeights?.join(', ') || ''}
                            onChange={(e) => updateField(selectedField.id, { rowHeights: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g., 30px, 40px"
                          />
                        </div>

                        {selectionRange && selectionRange.fieldId === selectedField.id ? (
                          <div className="space-y-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-slate-900 flex items-center">
                                <Grid className="w-4 h-4 mr-2 text-indigo-600" />
                                Cell Properties
                              </h4>
                              <button 
                                onClick={() => setSelectionRange(null)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Clear Selection
                              </button>
                            </div>

                            {/* Merge Controls */}
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-500">Merge Cells</label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" variant="outline" onClick={() => mergeSelection('all')} className="text-xs">Merge All</Button>
                                <Button size="sm" variant="outline" onClick={() => unmergeSelection()} className="text-xs">Unmerge</Button>
                                <Button size="sm" variant="outline" onClick={() => mergeSelection('horizontal')} className="text-xs">Merge Horiz.</Button>
                                <Button size="sm" variant="outline" onClick={() => mergeSelection('vertical')} className="text-xs">Merge Vert.</Button>
                              </div>
                            </div>

                            {/* Font Formatting */}
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-500">Font & Alignment</label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    const firstCell = getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol);
                                    updateSelectionStyle({ bold: !firstCell?.bold });
                                  }}
                                  className="p-1.5 border border-slate-300 rounded hover:bg-slate-50"
                                  title="Bold"
                                >
                                  <span className="font-bold">B</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const firstCell = getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol);
                                    updateSelectionStyle({ italic: !firstCell?.italic });
                                  }}
                                  className="p-1.5 border border-slate-300 rounded hover:bg-slate-50"
                                  title="Italic"
                                >
                                  <span className="italic">I</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const firstCell = getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol);
                                    updateSelectionStyle({ underline: !firstCell?.underline });
                                  }}
                                  className="p-1.5 border border-slate-300 rounded hover:bg-slate-50"
                                  title="Underline"
                                >
                                  <span className="underline">U</span>
                                </button>
                                <div className="flex border border-slate-300 rounded overflow-hidden">
                                  {(['left', 'center', 'right'] as const).map(align => (
                                    <button
                                      key={align}
                                      onClick={() => updateSelectionStyle({ align })}
                                      className="p-1.5 hover:bg-slate-50 border-r last:border-r-0"
                                      title={`Align ${align}`}
                                    >
                                      <div className={cn("w-3 h-0.5 bg-slate-600 mb-0.5", align === 'center' ? "mx-auto" : align === 'right' ? "ml-auto" : "")}></div>
                                      <div className="w-2 h-0.5 bg-slate-600 mb-0.5 mx-auto"></div>
                                      <div className={cn("w-3 h-0.5 bg-slate-600", align === 'center' ? "mx-auto" : align === 'right' ? "ml-auto" : "")}></div>
                                    </button>
                                  ))}
                                </div>
                                <div className="flex border border-slate-300 rounded overflow-hidden">
                                  {(['top', 'middle', 'bottom'] as const).map(vAlign => (
                                    <button
                                      key={vAlign}
                                      onClick={() => updateSelectionStyle({ verticalAlign: vAlign })}
                                      className="p-1.5 hover:bg-slate-50 border-r last:border-r-0 flex flex-col items-center justify-center"
                                      title={`Vertical ${vAlign}`}
                                    >
                                      <div className={cn("w-3 h-3 border border-slate-400 relative", vAlign === 'top' ? "border-t-slate-800" : vAlign === 'bottom' ? "border-b-slate-800" : "")}>
                                        <div className={cn("absolute left-0.5 right-0.5 h-0.5 bg-slate-600", vAlign === 'top' ? "top-0" : vAlign === 'bottom' ? "bottom-0" : "top-1/2 -translate-y-1/2")}></div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Font Size</label>
                                <input
                                  type="number"
                                  min="8"
                                  max="72"
                                  value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.fontSize || 12}
                                  onChange={(e) => updateSelectionStyle({ fontSize: parseInt(e.target.value) || 12 })}
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Col Width</label>
                                <input
                                  type="text"
                                  placeholder="auto, 100px"
                                  value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.width || ''}
                                  onChange={(e) => updateSelectionStyle({ width: e.target.value })}
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Row H.</label>
                                <input
                                  type="text"
                                  placeholder="auto, 40px"
                                  value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.height || ''}
                                  onChange={(e) => updateSelectionStyle({ height: e.target.value })}
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                />
                              </div>
                            </div>

                            {/* Colors */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Text Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.color || '#000000'}
                                    onChange={(e) => updateSelectionStyle({ color: e.target.value })}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                                  />
                                  <input 
                                    type="text" 
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.color || '#000000'} 
                                    onChange={(e) => updateSelectionStyle({ color: e.target.value })}
                                    className="w-full p-1 border border-slate-300 rounded text-[10px] font-mono"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Background</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.backgroundColor || '#ffffff'}
                                    onChange={(e) => updateSelectionStyle({ backgroundColor: e.target.value })}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                                  />
                                  <input 
                                    type="text" 
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.backgroundColor || '#ffffff'} 
                                    onChange={(e) => updateSelectionStyle({ backgroundColor: e.target.value })}
                                    className="w-full p-1 border border-slate-300 rounded text-[10px] font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Borders */}
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-500">Borders</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Color</label>
                                  <input
                                    type="color"
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.borderColor || '#cbd5e1'}
                                    onChange={(e) => updateSelectionStyle({ borderColor: e.target.value })}
                                    className="w-full h-6 p-0 border-0 rounded cursor-pointer"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400">Width</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.borderWidth || 1}
                                    onChange={(e) => updateSelectionStyle({ borderWidth: parseInt(e.target.value) || 0 })}
                                    className="w-full p-1 border border-slate-300 rounded text-xs"
                                  />
                                </div>
                              </div>
                              <select
                                value={getCellStyle(selectedField, selectionRange.startRow, selectionRange.startCol)?.borderStyle || 'solid'}
                                onChange={(e) => updateSelectionStyle({ borderStyle: e.target.value as any })}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs"
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-slate-100">
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-start space-x-3">
                              <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                              <p className="text-xs text-indigo-700 leading-relaxed">
                                <strong>Tip:</strong> Click on any cell in the table to customize its individual color, alignment, and borders.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedField.type === 'image' && (
                      <div className="space-y-2 pt-4 border-t border-slate-100">
                        <label className="text-sm font-medium text-slate-700">Image URL</label>
                        <input
                          type="text"
                          value={selectedField.content || ''}
                          onChange={(e) => updateField(selectedField.id, { content: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          placeholder="https://example.com/logo.png"
                        />
                        <p className="text-xs text-slate-500">Enter a direct link to the image</p>
                      </div>
                    )}

                    {selectedField.type === 'dropdown' && (
                      <div className="space-y-2 pt-4 border-t border-slate-100">
                        <label className="text-sm font-medium text-slate-700">Options (comma separated)</label>
                        <textarea
                          value={selectedField.options?.join(', ') || ''}
                          onChange={(e) => updateField(selectedField.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                          className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 h-24"
                          placeholder="Option 1, Option 2"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 mt-12">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Select an element on the canvas to edit its properties.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
