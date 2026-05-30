import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Calendar, User, Package, MapPin, ClipboardList, Loader2, ArrowLeft, History, ShoppingBag } from 'lucide-react';
import { Item, InventoryRecord } from '../types';

interface ItemHistoryProps {
  item: Item;
  onSelectRecord: (record: InventoryRecord) => void;
  onClose: () => void;
}

export default function ItemHistory({ item, onSelectRecord, onClose }: ItemHistoryProps) {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const stored = localStorage.getItem('jardi_records');
      if (stored) {
        const parsed = JSON.parse(stored) as InventoryRecord[];
        const filtered = parsed
          .filter((rec) => rec.itemId === item.id)
          .sort((a, b) => b.inventoryDate.localeCompare(a.inventoryDate));
        setRecords(filtered);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('فشل تحميل السجلات من الذاكرة المحلية للجهاز.');
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden h-full flex flex-col" id="item-history-panel">
      {/* Detail Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3 rlt:space-x-reverse">
          <button
            onClick={onClose}
            className="p-1.5 md:hidden text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            title="رجوع"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col text-right">
            <h2 className="text-base font-bold text-slate-950 font-display leading-tight">{item.name}</h2>
            <div className="flex items-center space-x-2 rtl:space-x-reverse mt-1">
              {item.code && (
                <span className="text-[10px] bg-emerald-100/60 text-emerald-800 font-mono font-semibold px-1.5 py-0.5 rounded">
                  {item.code}
                </span>
              )}
              {item.category && (
                <span className="text-[10px] bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded">
                  {item.category}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="hidden md:inline-flex px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
        >
          إغلاق التفاصيل
        </button>
      </div>

      {/* Main Container */}
      <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0">
        {/* History Headers */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <History className="h-4 w-4 text-slate-400" />
            <span>سجل عمليات تحقق الجرد</span>
          </h3>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-mono font-semibold">
            {records.length} عمليات جرد
          </span>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-2" />
            <p className="text-xs text-slate-400">جاري جلب تاريخ الجرد لهذا البند...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-xl text-xs text-right mb-6">
            {errorMsg}
          </div>
        ) : records.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-semibold">لا يوجد عمليات جرد مؤرشفة</p>
            <p className="text-[10px] text-slate-400 mt-1">يرجى رفع ملف الاستيراد لتوليد سجلات المطابقة.</p>
          </div>
        ) : (
          /* History Rows Table */
          <div className="flex-1 overflow-y-auto border border-slate-200/60 rounded-xl shadow-xs min-h-0 bg-white">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                  <th className="px-4 py-3 text-right">تاريخ الجرد</th>
                  <th className="px-4 py-3 text-right">اسم الموظف المسئول</th>
                  <th className="px-4 py-3 text-center">الكمية المقيدة</th>
                  {records.some((r) => r.location) && <th className="px-4 py-3 text-right hidden sm:table-cell">الموقع</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => onSelectRecord(record)}
                    className="hover:bg-emerald-50/20 active:bg-emerald-50/40 transition-colors cursor-pointer group"
                    id={`record-row-${record.id}`}
                  >
                    <td className="px-4 py-3 text-xs font-medium font-mono text-emerald-700 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600/60 group-hover:scale-110 transition-transform" />
                      {record.inventoryDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold block truncate max-w-[120px] sm:max-w-xs">{record.personName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-center text-slate-900 font-mono">
                      {record.quantity}
                    </td>
                    {records.some((r) => r.location) && (
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                        {record.location || '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
