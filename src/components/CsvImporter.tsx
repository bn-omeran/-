import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, Table, Loader2, Trash2 } from 'lucide-react';
import { Item, InventoryRecord } from '../types';

interface CsvImporterProps {
  userId: string;
  onImportComplete: () => void;
  existingItems: Item[];
}

const ALIASES: Record<string, string[]> = {
  name: ['اسم المادة', 'اسم الصنف', 'الصنف', 'الاسم', 'العنصر', 'البند', 'item name', 'name', 'item', 'product', 'designation'],
  date: ['تاريخ السند', 'تاريخ الجرد', 'التاريخ', 'تاريخ', 'يوم', 'date', 'inventory date', 'check date', 'date of check'],
  person: ['مسؤول الجرد', 'مسؤل الجرد', 'المستخدم', 'المسؤول', 'الموظف', 'اسم المفتش', 'من قام بالجرد', 'اسم الشخص', 'الشخص', 'الجارد', 'person name', 'person', 'inspector', 'checked by', 'staff', 'operator', 'name'],
  quantity: ['كمية الجرد', 'الكمية المطابقة', 'الرصيد الفعلي', 'الكمية', 'العدد', 'المتوفر', 'رصيد', 'المجموع', 'quantity', 'qty', 'count', 'amount', 'stock'],
  code: ['رمز المادة', 'الملصق', 'الباركود', 'الكود', 'الرمز', 'رقم الصنف', 'sku', 'code', 'barcode', 'serial', 'part number'],
  category: ['التصنيف', 'الفئة', 'القسم', 'فئة', 'category', 'type', 'group', 'department', 'dept'],
  location: ['رقم الشلف او الموقع', 'رقم الشلف', 'الموقع', 'الرف', 'المستودع', 'المخزن', 'العنوان', 'location', 'warehouse', 'store', 'rack', 'aisle'],
  notes: ['الشرح', 'ملاحظات السند', 'الملاحظات', 'ملاحظات', 'تنبيه', 'ملاحظة', 'notes', 'note', 'remarks', 'remark', 'comments'],
  unit: ['الوحدة', 'unit'],
  warehouseQty: ['كمية المستودع', 'warehouseQty', 'المستودع'],
  diffQty: ['الكمية الفرق / العجز - الفائض', 'الكمية الفرق/العجز - الفائض', 'الكمية الزيادة والنقصان', 'الكمية الفرق', 'الكمية', 'فرق الكمية', 'الفرق', 'التنزيل', 'كمية التنزيل', 'العجز والزيادة', 'العجز', 'الفارق', 'diffQty'],
  
  // Custom requested extra fields
  matchingNo: ['رقم المطابقة', 'المطابقة', 'رقم التسويه', 'matchingNo', 'reconciliationNo'],
  detailLineNo: ['رقم سطر التفصيل', 'رقم السطر', 'السطر', 'detailLineNo', 'lineNo'],
  itemNotes: ['ملاحظات جرد في الصنف', 'ملاحضات جرد في الصنف', 'ملاحظات الصنف', 'ملاحظات الصنف الجردية', 'itemNotes'],
  sheetNo: ['رقم الورقة', 'الورقة', 'sheetNo', 'pageNo'],
  dataEntryPerson: ['مدخل البيانات', 'مدخل البيانات القائم بالجرد', 'المدخل', 'dataEntryPerson', 'dataEntry'],
  sheetNotes: ['ملاحظات الورقة الجرد كاملة', 'ملاحظات الورقة الجرد', 'ملاحظات الورقة كليا', 'sheetNotes'],
  generalManagerNotes: ['ملاحظات من المسؤول العام', 'ملاحظات من مسؤل العام', 'ملاحظات مسؤل العام', 'ملاحظات المسؤول العام', 'generalManagerNotes', 'managerNotes'],
  isApproved: ['هل معتمد', 'معتمد', 'مقبول', 'حالة الاعتماد', 'isApproved', 'approved']
};

export default function CsvImporter({ userId, onImportComplete, existingItems }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'success'>('upload');
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ total: 0, inserted: 0, itemsCreated: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const keySchema = [
    { key: 'name', label: 'اسم المادة (اسم الصنف)', required: true },
    { key: 'date', label: 'تاريخ السند (تاريخ الجرد)', required: true },
    { key: 'person', label: 'مسؤول الجرد القائم بالعمل', required: true },
    { key: 'quantity', label: 'كمية الجرد (الفعلي)', required: true },
    { key: 'code', label: 'رمز المادة (الكود)', required: false },
    { key: 'unit', label: 'الوحدة (حبة، قصبة، لفة)', required: false },
    { key: 'warehouseQty', label: 'كمية المستودع (الدفتري)', required: false },
    { key: 'diffQty', label: 'الكمية الفرق / العجز - الفائض', required: false },
    { key: 'location', label: 'رقم الشلف او الموقع', required: false },
    
    // New fields in schema mapping view
    { key: 'matchingNo', label: 'رقم المطابقة / السند', required: false },
    { key: 'detailLineNo', label: 'رقم سطر التفصيل', required: false },
    { key: 'itemNotes', label: 'ملاحظات جرد في الصنف', required: false },
    { key: 'sheetNo', label: 'رقم الورقة / الصفحة', required: false },
    { key: 'dataEntryPerson', label: 'مدخل البيانات الخاص بالجرد', required: false },
    { key: 'sheetNotes', label: 'ملاحظات الورقة الجرد كاملة', required: false },
    { key: 'generalManagerNotes', label: 'ملاحظات من المسؤول العام', required: false },
    { key: 'isApproved', label: 'هل معتمد (معتمد أم لا)؟', required: false },
    
    { key: 'notes', label: 'الشرح / ملاحظات السند العامة', required: false },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setErrorMsg('الرجاء اختيار ملف بصيغة CSV فقط.');
      return;
    }
    setErrorMsg(null);
    setFile(selectedFile);

    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setErrorMsg('فشل قراءة الملف. يرجى التأكد من أن الملف بصيغة CSV صالحة.');
          return;
        }

        const dataHeaders = results.meta.fields || [];
        setHeaders(dataHeaders);
        setParsedData(results.data);

        // Auto-mapping logic
        const initialMappings: Record<string, string> = {};
        const mappedHeaders = new Set<string>();
        
        // We evaluate schema items in sequence and ensure headers are not double-mapped.
        keySchema.forEach((schemaItem) => {
          const matchedHeader = dataHeaders.find((header) => {
            if (mappedHeaders.has(header)) return false;
            const normalizedHeader = header.trim().toLowerCase();
            return ALIASES[schemaItem.key].some((alias) => {
              const normalizedAlias = alias.trim().toLowerCase();
              return normalizedHeader === normalizedAlias || normalizedHeader.includes(normalizedAlias);
            });
          });
          if (matchedHeader) {
            initialMappings[schemaItem.key] = matchedHeader;
            mappedHeaders.add(matchedHeader);
          }
        });

        setMappings(initialMappings);
        setStep('mapping');
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleMappingChange = (key: string, header: string) => {
    setMappings((prev) => ({ ...prev, [key]: header }));
  };

  const executeImport = async () => {
    // Validate required mappings
    const missingRequired = keySchema
      .filter((s) => s.required)
      .filter((s) => !mappings[s.key]);

    if (missingRequired.length > 0) {
      setErrorMsg(`يرجى تحديد أعمدة لـ : ${missingRequired.map((m) => m.label).join(', ')}`);
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setErrorMsg(null);

    // Minor delay to feel responsive
    await new Promise((res) => setTimeout(res, 500));

    try {
      const totalRows = parsedData.length;
      let itemsCreatedCount = 0;
      let recordsCreatedCount = 0;

      // Extract existing local registers
      const storedItemsRaw = localStorage.getItem('jardi_items');
      const storedRecordsRaw = localStorage.getItem('jardi_records');

      const allItemsList: Item[] = storedItemsRaw ? JSON.parse(storedItemsRaw) : [];
      const allRecordsList: InventoryRecord[] = storedRecordsRaw ? JSON.parse(storedRecordsRaw) : [];

      // Index dynamically
      const localItemMap = new Map<string, Item>();
      allItemsList.forEach((it) => {
        localItemMap.set(it.name.trim().toLowerCase(), it);
      });

      // Group records by clean Item Name to prevent duplicate entries
      const rowsByItemName = new Map<string, Record<string, string>[]>();
      parsedData.forEach((row) => {
        const rawName = row[mappings.name];
        if (!rawName) return; // Skip empty item name
        const cleanName = rawName.trim();
        const key = cleanName.toLowerCase();
        
        if (!rowsByItemName.has(key)) {
          rowsByItemName.set(key, []);
        }
        rowsByItemName.get(key)!.push(row);
      });

      const itemKeys = Array.from(rowsByItemName.keys());

      for (let i = 0; i < itemKeys.length; i++) {
        const itemKey = itemKeys[i];
        const rows = rowsByItemName.get(itemKey)!;
        const firstRow = rows[0];
        
        const cleanItemName = firstRow[mappings.name].trim();
        const code = mappings.code ? firstRow[mappings.code]?.trim() : '';
        const category = mappings.category ? firstRow[mappings.category]?.trim() : '';

        // Check if item already exists globally
        let item = localItemMap.get(itemKey);
        let itemId = item?.id;

        // Find chronological latest details from the records to upload
        let recordLatestDate = '';
        let recordLatestPerson = '';
        let recordLatestQty = 0;
        let recordLatestLoc = '';
        let recordLatestUnit = '';
        let recordLatestWHQty = 0;
        let recordLatestDiffQty = 0;

        // Iterate rows to gather latest date
        rows.forEach((row) => {
          const rowDate = row[mappings.date]?.trim() || '';
          if (!recordLatestDate || rowDate > recordLatestDate) {
            recordLatestDate = rowDate;
            recordLatestPerson = row[mappings.person]?.trim() || '';
            recordLatestQty = Number(row[mappings.quantity]) || 0;
            recordLatestLoc = mappings.location ? row[mappings.location]?.trim() : '';
            recordLatestUnit = mappings.unit ? row[mappings.unit]?.trim() : '';
            recordLatestWHQty = mappings.warehouseQty ? Number(row[mappings.warehouseQty]) || 0 : 0;
            
            let latestDiff = 0;
            if (mappings.diffQty) {
              const rawVal = row[mappings.diffQty]?.trim() || '';
              const cleanNum = rawVal.replace(/[^\d.-]/g, '');
              latestDiff = Number(cleanNum) || 0;
            } else if (mappings.warehouseQty && mappings.quantity) {
              latestDiff = recordLatestQty - recordLatestWHQty;
            }
            recordLatestDiffQty = latestDiff;
          }
        });

        // If item doesn't exist, create it
        if (!itemId) {
          itemId = 'item_' + Math.random().toString(36).substr(2, 9);
          itemsCreatedCount++;

          const newItem: Item = {
            id: itemId,
            name: cleanItemName,
            code: code || '',
            category: category || '',
            latestDate: recordLatestDate || '',
            latestPerson: recordLatestPerson || '',
            latestQuantity: recordLatestQty,
            latestLocation: recordLatestLoc || '',
            latestUnit: recordLatestUnit || '',
            latestWarehouseQty: recordLatestWHQty,
            latestDiffQty: recordLatestDiffQty,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerId: userId,
          };

          allItemsList.push(newItem);
          localItemMap.set(itemKey, newItem);
        } else if (item) {
          // If item exists, update its latest properties if newer
          const currentLatest = item.latestDate || '';
          if (recordLatestDate && recordLatestDate >= currentLatest) {
            item.latestDate = recordLatestDate;
            item.latestPerson = recordLatestPerson;
            item.latestQuantity = recordLatestQty;
            item.latestLocation = recordLatestLoc || '';
            item.latestUnit = recordLatestUnit || '';
            item.latestWarehouseQty = recordLatestWHQty;
            item.latestDiffQty = recordLatestDiffQty;
            item.updatedAt = new Date().toISOString();
          }
        }

        // Add records
        for (const row of rows) {
          const inventoryDate = row[mappings.date]?.trim() || '';
          const personName = row[mappings.person]?.trim() || '';
          const quantity = Number(row[mappings.quantity]) || 0;
          const location = mappings.location ? row[mappings.location]?.trim() : '';
          const unit = mappings.unit ? row[mappings.unit]?.trim() : '';
          const warehouseQty = mappings.warehouseQty ? Number(row[mappings.warehouseQty]) || 0 : 0;
          
          let diffQty = 0;
          if (mappings.diffQty) {
            const rawVal = row[mappings.diffQty]?.trim() || '';
            const cleanNum = rawVal.replace(/[^\d.-]/g, '');
            diffQty = Number(cleanNum) || 0;
          } else if (mappings.warehouseQty && mappings.quantity) {
            diffQty = quantity - warehouseQty;
          }
          const notes = mappings.notes ? row[mappings.notes]?.trim() : '';

          // Read custom requested fields
          const matchingNo = mappings.matchingNo ? row[mappings.matchingNo]?.trim() : '';
          const detailLineNo = mappings.detailLineNo ? row[mappings.detailLineNo]?.trim() : '';
          const itemNotes = mappings.itemNotes ? row[mappings.itemNotes]?.trim() : '';
          const sheetNo = mappings.sheetNo ? row[mappings.sheetNo]?.trim() : '';
          const dataEntryPerson = mappings.dataEntryPerson ? row[mappings.dataEntryPerson]?.trim() : '';
          const sheetNotes = mappings.sheetNotes ? row[mappings.sheetNotes]?.trim() : '';
          const generalManagerNotes = mappings.generalManagerNotes ? row[mappings.generalManagerNotes]?.trim() : '';
          const isApproved = mappings.isApproved ? row[mappings.isApproved]?.trim() : '';

          // Save any unused headers as additionalFields
          const additionalFields: Record<string, string> = {};
          Object.keys(row).forEach((colHeader) => {
            const isMapped = Object.values(mappings).includes(colHeader);
            if (!isMapped && row[colHeader]) {
              additionalFields[colHeader] = row[colHeader];
            }
          });

          const newRecord: InventoryRecord = {
            id: 'rec_' + Math.random().toString(36).substr(2, 9),
            itemId,
            itemName: cleanItemName,
            inventoryDate,
            personName,
            quantity,
            location: location || '',
            unit: unit || '',
            warehouseQty,
            diffQty,
            notes: notes || '',
            matchingNo: matchingNo || '',
            detailLineNo: detailLineNo || '',
            itemNotes: itemNotes || '',
            sheetNo: sheetNo || '',
            dataEntryPerson: dataEntryPerson || '',
            sheetNotes: sheetNotes || '',
            generalManagerNotes: generalManagerNotes || '',
            isApproved: isApproved || '',
            additionalFields,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerId: userId,
          };

          allRecordsList.push(newRecord);
          recordsCreatedCount++;
        }

        setImportProgress(Math.round(((i + 1) / itemKeys.length) * 100));
      }

      // Commit to localStorage
      localStorage.setItem('jardi_items', JSON.stringify(allItemsList));
      localStorage.setItem('jardi_records', JSON.stringify(allRecordsList));

      setImportStats({
        total: recordsCreatedCount,
        inserted: recordsCreatedCount,
        itemsCreated: itemsCreatedCount,
      });
      setStep('success');
      onImportComplete();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`فشل الحفظ في الأرشيف المحلي: ${err.message || String(err)}`);
      setStep('mapping');
    }
  };

  const handleWipeExisting = () => {
    setShowWipeConfirm(true);
  };

  const loadSampleData = () => {
    const sampleCsv = `اسم المادة,رمز المادة,الوحدة,كمية المستودع,كمية الجرد,الكمية,المستخدم,تاريخ السند,رقم الشلف,الشرح
مغسلة رخام فوق ابيض صافي مربع بدون فتحة خلاط موديل A011,19003,حبة,52,52,0,عبدالرحمن احمد عميران,02.05.2026,,توليد فواتير التسوية
4 هـ ابيض بلاستيك ماصورة سماكة 2.2 ملم مصنع خيرات عدن MEDIUM (وسط),15898,قصبة,27,27,0,عبدالرحمن احمد عميران,02.05.2026,8,+ 5
سلك 2.5 ملم مفرد احمر حراري (AWG 14) طول 67 متر,13047,لفة,19,19,0,محسن المحضار,01.05.2026,3-43,توليد فواتير التسوية
قاطع طبلون مفرد 16 امبير LS كوري أصلي,15684,حبة,44,44,0,محسن المحضار,01.05.2026,3-32,توليد فواتير التسوية`;

    Papa.parse<Record<string, string>>(sampleCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dataHeaders = results.meta.fields || [];
        setHeaders(dataHeaders);
        setParsedData(results.data);

        const initialMappings: Record<string, string> = {};
        const mappedHeaders = new Set<string>();

        keySchema.forEach((schemaItem) => {
          const matchedHeader = dataHeaders.find((header) => {
            if (mappedHeaders.has(header)) return false;
            const normalizedHeader = header.trim().toLowerCase();
            return ALIASES[schemaItem.key].some((alias) => {
              const normalizedAlias = alias.trim().toLowerCase();
              return normalizedHeader === normalizedAlias || normalizedHeader.includes(normalizedAlias);
            });
          });
          if (matchedHeader) {
            initialMappings[schemaItem.key] = matchedHeader;
            mappedHeaders.add(matchedHeader);
          }
        });

        setMappings(initialMappings);
        setStep('mapping');
      }
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all" id="csv-importer-panel">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900 font-display">استيراد السجلات من ملف CSV</h2>
        </div>
        
        {step !== 'upload' && (
          <button
            onClick={() => setStep('upload')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center"
          >
            إلغاء والعودة
          </button>
        )}
      </div>

      <div className="p-6">
        {errorMsg && (
          <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 rtl:text-right">
            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group"
              id="csv-dropzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />
              <div className="bg-white p-4 rounded-full shadow-2xs border border-slate-100 mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className="h-7 w-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-slate-950 font-display">اسحب وأفلت ملف الـ CSV هنا</h3>
              <p className="text-xs text-slate-500 mt-1">أو انقر هنا لتصفح الملفات من جهازك</p>
              <span className="text-[10px] text-slate-400 mt-2 block">الحجم الأقصى للملف: 5 ميجابايت</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 gap-3 sm:gap-4">
              <div className="text-right sm:text-right rtl:text-right">
                <p className="text-xs font-semibold text-emerald-950">ليس لديك ملف جاهز؟</p>
                <p className="text-[11px] text-emerald-800 mt-0.5">يمكنك تجربة النظام مباشرة باستخدام بيانات جرد افتراضية أو مسح وتصفير كافة السجلات المخزنة للبدء من جديد.</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {existingItems.length > 0 && (
                  <button
                    onClick={handleWipeExisting}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100/90 text-rose-600 border border-rose-200/60 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    id="wipe-existing-btn"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    <span>حذف كافة البيانات السابقة</span>
                  </button>
                )}
                <button
                  onClick={loadSampleData}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  id="load-sample-btn"
                >
                  تحميل بيانات تجريبية
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MAPPING */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 text-xs text-amber-900 leading-relaxed rtl:text-right">
              👋 تم فحص ملفك بنجاح وقراءة <span className="font-bold font-mono text-[13px]">{parsedData.length}</span> صفوف.
              يرجى تأكيد العلاقة بين رؤوس جداول ملفك والمدخلات المطلوبة في تطبيق <span className="font-semibold text-emerald-700">جردي</span> أدناه:
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {keySchema.map((field) => (
                <div key={field.key} className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      {field.label}
                      {field.required && <span className="text-rose-500 text-sm font-bold">*</span>}
                    </span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
                      {field.key}
                    </span>
                  </div>

                  <select
                    value={mappings[field.key] || ''}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    className="w-full bg-white border border-slate-200 outline-none rounded-lg px-3 py-2 text-xs text-slate-700 font-sans focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">-- اختر رأس العمود --</option>
                    {headers.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-4 border-t border-slate-100">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                تغيير الملف
              </button>
              <button
                onClick={executeImport}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center"
                id="start-import-btn"
              >
                ابدأ الاستيراد الفعلي
                <ArrowRight className="h-3.5 w-3.5 ml-2 rtl:rotate-180 rtl:mr-2 rtl:ml-0" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center text-center justify-center">
            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
            <h3 className="text-sm font-semibold text-slate-900 font-display">جاري استيراد السجلات وتحديث الأرشيف...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">يرجى الانتظار وعدم إغلاق النافذة أثناء إضافة البيانات وفهرستها بنجاح.</p>
            
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-semibold text-emerald-700 mt-2">{importProgress}% مكتمل</span>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="text-base font-bold text-slate-950 font-display">تمت عملية الاستيراد بنجاح!</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm">تم استيراد كافة السجلات بنجاح ومزامنتها لحظياً مع قاعدة البيانات السحابية.</p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs bg-slate-50 border border-slate-100 rounded-xl p-4 mt-6">
              <div className="text-center p-2 border-r border-slate-200 rtl:border-r-0 rtl:border-l">
                <span className="block text-xl font-bold font-mono text-emerald-700">{importStats.total}</span>
                <span className="text-[10px] text-slate-400">سجل جرد كلي</span>
              </div>
              <div className="text-center p-2">
                <span className="block text-xl font-bold font-mono text-emerald-700">{importStats.itemsCreated}</span>
                <span className="text-[10px] text-slate-400">أصناف جديدة مضافة</span>
              </div>
            </div>

            <button
              onClick={() => {
                setFile(null);
                setStep('upload');
              }}
              className="mt-6 px-5 py-2 border border-slate-200 hover:bg-slate-50 font-semibold text-slate-600 text-xs rounded-xl transition-all cursor-pointer"
            >
              استيراد ملف آخر
            </button>
          </div>
        )}

        {/* Custom Wipe Confirmation modal */}
        {showWipeConfirm && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in" dir="rtl">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full inline-flex mb-2">
                <Trash2 className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">تأكيد مسح كافة البيانات</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                🚨 تحذير: هل أنت متأكد من مسح وتصفير كافة السجلات والأصناف المخزنة على هذا الجهاز نهائياً؟ لا يمكن التراجع عن هذه العملية بعد تأكيدها.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    localStorage.removeItem('jardi_items');
                    localStorage.removeItem('jardi_records');
                    setShowWipeConfirm(false);
                    onImportComplete();
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  نعم، امسح نهائياً
                </button>
                <button
                  onClick={() => setShowWipeConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
