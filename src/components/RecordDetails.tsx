import { ArrowLeft, Calendar, User, ShoppingBag, MapPin, FileText, CheckCircle2, ChevronRight, Hash, Database, Layers } from 'lucide-react';
import { InventoryRecord } from '../types';

interface RecordDetailsProps {
  record: InventoryRecord;
  itemCode?: string;
  itemCategory?: string;
  onBack: () => void;
}

export default function RecordDetails({ record, itemCode, itemCategory, onBack }: RecordDetailsProps) {
  // Format dates beautifully if valid
  const formattedCreationDate = record.createdAt 
    ? new Date(record.createdAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const replaceText = (text: string) => {
    if (!text) return text;
    return text.includes('توليد فواتير التسوية') ? text.replace(/توليد فواتير التسوية/g, 'جرد معتمد') : text;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col" id="record-details-panel">
      {/* Top action header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          id="back-to-item-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>العودة لسجل الصنف</span>
        </button>

        <span className="text-[11px] bg-emerald-50 text-emerald-800 font-mono font-bold px-2 py-1 rounded-sm">
          مستند جرد معتمد
        </span>
      </div>

      {/* Main details block */}
      <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 text-right">
        {/* Title and main check indicator */}
        <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-extrabold uppercase tracking-wide">
              سند جرد معتمد
            </span>
            <h1 className="text-xl font-bold text-slate-900 font-display mt-2">{record.itemName}</h1>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 justify-end md:justify-start">
              <span>تاريخ الإمضاء بالسند: </span>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{record.inventoryDate}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl self-start md:self-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 shrink-0" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي رصيد الجرد الفعلي</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-600 leading-none">{record.quantity} {record.unit || 'وحدة'}</span>
            </div>
          </div>
        </div>

        {/* Core Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="record-details-grid-sections">
          
          {/* Group 3: Stock Auditing (Full width at top) */}
          <div className="border border-slate-200 md:col-span-2 rounded-2xl p-6 bg-slate-50/10 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-150 pb-3.5 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">مقارنة رصيد الكميات والفرق الفعلي</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-bold font-mono">
                المعادلة: كمية الجرد الفعلي - كمية المستودع = الكمية الفرق
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Warehouse Qty Card */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-center shadow-2xs hover:border-slate-300/80 transition-colors">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">كمية المستودع (الدفتري)</span>
                <span className="text-xl font-black font-mono text-slate-700">
                  {typeof record.warehouseQty === 'number' ? record.warehouseQty : '0'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{record.unit || 'وحدة'}</span>
              </div>

              {/* Counting Qty Card */}
              <div className="bg-emerald-50/30 border border-emerald-100/70 rounded-xl p-4 text-center shadow-2xs hover:border-emerald-200/80 transition-colors">
                <span className="text-[10px] text-emerald-700 font-bold block mb-1">كمية الجرد (الفعلي)</span>
                <span className="text-xl font-black font-mono text-emerald-700">
                  {record.quantity}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">{record.unit || 'وحدة'}</span>
              </div>

              {/* Difference Calc Card */}
              <div className="bg-slate-50/10 border border-slate-200/60 rounded-xl p-4 text-center shadow-2xs hover:border-slate-300/80 transition-colors flex flex-col justify-center items-center">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">الكمية الفرق / العجز - الفائض</span>
                <div>
                  {typeof record.diffQty === 'number' ? (
                    <div className="flex flex-col items-center">
                      <span className={`text-xl font-black font-mono ${
                        record.diffQty > 0 ? 'text-emerald-700' : record.diffQty < 0 ? 'text-rose-700' : 'text-slate-600'
                      }`}>
                        {record.diffQty > 0 ? `+${record.diffQty}` : record.diffQty}
                      </span>
                      <span className={`text-[10px] font-semibold mt-0.5 ${
                        record.diffQty > 0 ? 'text-emerald-600' : record.diffQty < 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {record.diffQty > 0 ? 'زيادة (فائض)' : record.diffQty < 0 ? 'عجز (نقصان)' : 'مطابق تماماً'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold font-mono text-slate-700">
                        {replaceText(record.additionalFields?.['الكمية'] || '0')}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">القيمة اليدوية</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Group 1: Document Details & Compliance */}
          <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/20 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 justify-start">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Database className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">بيانات التوثيق والمطابقة الرسمية</h3>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">رقم المطابقة / السند</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded text-[11px]">
                    {replaceText(record.matchingNo || record.additionalFields?.['Source.Name'] || record.additionalFields?.['source.name'] || 'غير متوفر')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">رقم الورقة / الصفحة</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded text-[11px]">
                    {record.sheetNo || 'غير متوفر'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">حالة الاعتماد في السند</span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    record.isApproved?.includes('نعم') || record.isApproved?.toLowerCase() === 'true' || record.isApproved?.includes('معتمد')
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/40' 
                      : 'bg-amber-50 text-amber-800 border border-amber-200/40'
                  }`}>
                    {record.isApproved || 'معتمد (افتراضي بقبول السند)'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-semibold">تاريخ السند الموثق</span>
                  <span className="font-mono font-bold text-slate-800">
                    {replaceText(record.inventoryDate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Product Specifications */}
          <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/20 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 justify-start">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">البيانات التعريفية للمادة</h3>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">رمز المادة / الكود</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                    {replaceText(itemCode || record.additionalFields?.['رمز المادة'] || 'غير متوفر')}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">رقم سطر التفصيل بالسند</span>
                  <span className="font-mono font-bold text-slate-850 px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                    {record.detailLineNo || 'غير محدد'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-150 pb-2">
                  <span className="text-slate-500 font-semibold">رقم الشلف او الموقع (الرف)</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-bold text-slate-850 text-[11px]">
                      {replaceText(record.location || 'غير محدد')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-semibold">وحدة القياس</span>
                  <span className="font-bold text-slate-800 bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded-md">
                    {replaceText(record.unit || 'غير محددة')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 4: Responsible parties */}
          <div className="border border-slate-200 md:col-span-2 rounded-2xl p-5 bg-slate-50/20 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-150 pb-2.5 mb-3.5 justify-start">
              <User className="h-4 w-4 text-slate-600" />
              <h3 className="font-bold text-sm text-slate-1000">الكوادر البشرية المسؤولة</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-150/60 rounded-xl">
                <span className="text-slate-500 font-semibold">مسؤول الجرد (القائم بالجرد)</span>
                <span className="font-bold text-slate-800 bg-slate-100/60 px-2.5 py-1 rounded">
                  {replaceText(record.personName || 'غير محدد')}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border border-slate-150/60 rounded-xl">
                <span className="text-slate-500 font-semibold">مدخل البيانات (المستخدم الحالي)</span>
                <span className="font-bold text-slate-800 bg-slate-100/60 px-2.5 py-1 rounded">
                  {replaceText(record.dataEntryPerson || 'مسؤول الجرد التلقائي')}
                </span>
              </div>
            </div>
          </div>

          {/* Group 5: Remarks and Notes */}
          <div className="border border-slate-200 md:col-span-2 rounded-2xl p-5 bg-white shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2 justify-start border-b border-slate-150 pb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>مذكرات وجرد التفاصيل الملحقة</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-right">
              <div className="p-3 bg-amber-50/40 border border-amber-100/60 rounded-xl">
                <span className="text-amber-800 font-bold block mb-1">ملاحظات جرد في الصنف</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {record.itemNotes || 'لا توجد ملاحظات خاصة بجرد هذا الصنف تلقائياً.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50/70 border border-slate-150/60 rounded-xl">
                <span className="text-slate-500 font-bold block mb-1">ملاحظات الورقة الجرد كاملة</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {record.sheetNotes || 'لا توجد ملاحظات مدونة لكامل مستند جرد الورقة.'}
                </p>
              </div>

              <div className="p-3 bg-blue-50/30 border border-blue-100/50 rounded-xl md:col-span-2">
                <span className="text-blue-700 font-bold block mb-1">ملاحظات من المسؤول العام</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {record.generalManagerNotes || 'لا توجد ملاحظات معتمدة إضافية من المدير أو المسؤول العام.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes block */}
        <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 justify-end">
            <span>ملاحظات السند / بيان الشرح</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </h3>
          <div className="bg-white border border-slate-100 rounded-lg p-3 text-xs text-slate-700 leading-relaxed font-sans min-h-[60px]">
            {record.notes ? replaceText(record.notes) : 'لا توجد ملاحظات شرحية ملحقة بهذا السند.'}
          </div>
        </div>
      </div>
    </div>
  );
}
