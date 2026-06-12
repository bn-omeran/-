import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import AuthBar from './components/AuthBar';
import CsvImporter from './components/CsvImporter';
import ItemHistory from './components/ItemHistory';
import RecordDetails from './components/RecordDetails';
import { Item, InventoryRecord } from './types';
import { 
  Search, 
  Plus, 
  Database, 
  Trash2, 
  Lock, 
  CheckCircle, 
  HelpCircle, 
  HardDrive, 
  Upload, 
  Layers, 
  Loader2, 
  X,
  Sparkles,
  ChevronLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\u064B-\u0652]/g, '') // Remove Arabic tashkeel/diacritics
    .trim();
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDanger: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Simulate active session as requested - run entirely locally without account delay
  useEffect(() => {
    setUser({
      uid: 'local_device_user',
      email: 'bn.omeran.1@gmail.com',
      displayName: 'مستودع عبدالرحمن احمد عميران',
      emailVerified: true,
      providerId: 'local',
      isAnonymous: false,
      metadata: {},
      providerData: []
    } as any);
    setAuthLoading(false);
  }, []);

  // Update lists from localStorage on user change / database edits
  const reloadData = () => {
    setItemsLoading(true);
    try {
      const storedItems = localStorage.getItem('jardi_items');
      if (storedItems) {
        const parsed = JSON.parse(storedItems) as Item[];
        parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setItems(parsed);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setItemsError('فشل تحميل الأصناف من الذاكرة المحلية للجهاز.');
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      reloadData();
    }
  }, [user]);

  // Login handler
  const loginWithGoogle = async () => {
    // Already loaded locally, no action needed
  };

  // Memoized pre-normalized search fields for extreme performance
  const preNormalizedItems = useMemo(() => {
    return items.map((item) => ({
      item,
      normalizedName: normalizeText(item.name),
      normalizedCategory: normalizeText(item.category || ''),
    }));
  }, [items]);

  // Fuzzy match filter restricted solely to name and category
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const normalizedQuery = normalizeText(searchQuery);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    if (queryWords.length === 0) return items;

    return preNormalizedItems
      .filter(({ normalizedName, normalizedCategory }) => {
        const searchableText = `${normalizedName} ${normalizedCategory}`;
        return queryWords.every((word) => searchableText.includes(word));
      })
      .map(({ item }) => item);
  }, [preNormalizedItems, searchQuery]);

  // Delete inventory item and its records natively from local storage
  const handleDeleteItem = (itemToDelete: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'حذف الصنف نهائياً',
      message: `هل أنت متأكد من حذف الصنف "${itemToDelete.name}" وكافة سجلاته وتاريخه نهائياً؟ لا يمكن التراجع عن هذه العملية.`,
      confirmText: 'نعم، احذف',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: () => {
        try {
          const storedItems = localStorage.getItem('jardi_items');
          const storedRecords = localStorage.getItem('jardi_records');

          let updatedItems: Item[] = [];
          if (storedItems) {
            const parsed = JSON.parse(storedItems) as Item[];
            updatedItems = parsed.filter((it) => it.id !== itemToDelete.id);
            localStorage.setItem('jardi_items', JSON.stringify(updatedItems));
          }

          if (storedRecords) {
            const parsed = JSON.parse(storedRecords) as InventoryRecord[];
            const updatedRecords = parsed.filter((rec) => rec.itemId !== itemToDelete.id);
            localStorage.setItem('jardi_records', JSON.stringify(updatedRecords));
          }

          setItems(updatedItems);
          if (selectedItem?.id === itemToDelete.id) {
            setSelectedItem(null);
            setSelectedRecord(null);
          }
        } catch (err) {
          console.error(err);
        }
        setConfirmState(null);
      }
    });
  };

  // Wipe all databases locally
  const handleWipeAll = () => {
    setConfirmState({
      isOpen: true,
      title: 'تصفير ومسح كافة البيانات',
      message: '🚨 تحذير: هل أنت متأكد من مسح وتصفير كافة السجلات والأصناف المخزنة على هذا الجهاز نهائياً؟ لا يمكن التراجع عن هذه العملية.',
      confirmText: 'نعم، امسح كل شيء',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: () => {
        localStorage.removeItem('jardi_items');
        localStorage.removeItem('jardi_records');
        setItems([]);
        setSelectedItem(null);
        setSelectedRecord(null);
        setImporterOpen(false);
        setConfirmState(null);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      {/* Dynamic Header */}
      <AuthBar user={user} loading={authLoading} />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        {/* If user is not logged in, show Auth Screen */}
        {authLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mb-3" />
            <p className="text-slate-500 text-sm">جاري مراجعة الجلسة الأمنية...</p>
          </div>
        ) : !user ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 text-center max-w-lg mx-auto my-auto shadow-sm" id="auth-gate-box">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl inline-flex mb-6 shadow-2xs">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">أرشيف جرد المخازن اليومي المنظم</h2>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              مرحباً بك في منصة <span className="font-semibold text-slate-900">جردي</span>.
              يرجى تسجيل الدخول بحساب Google لرفع ملفات الأرشيف ومزامنة السجلات وبدء البحث والفلترة.
            </p>

            <button
              onClick={loginWithGoogle}
              className="mt-8 relative inline-flex items-center justify-center px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-md cursor-pointer filter hover:brightness-105 active:scale-[0.98] w-full"
            >
              🚀 تسجيل الدخول سريعاً بـ Google
            </button>
            <span className="text-[11px] text-slate-400 mt-4 block">تخزين سحابي فوري وآمن ۱۰۰٪ على قواعد بيانات Google Firebase.</span>
          </div>
        ) : (
          /* Main Authenticated UI Dashboard */
          <div className="flex-grow flex flex-col md:flex-row gap-6 min-h-0">
            {/* Sidebar Column: Search, Stats and List */}
            <div className={`w-full md:w-[380px] flex flex-col shrink-0 min-h-0 ${selectedItem ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Dashboard Action Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 mb-4">
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-1.5">
                    {items.length > 0 && (
                      <button
                        onClick={handleWipeAll}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="تصفير ومسح كافة البيانات"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setImporterOpen(!importerOpen);
                        setSelectedItem(null);
                        setSelectedRecord(null);
                      }}
                      className={`inline-flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        importerOpen
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                      id="toggle-importer-btn"
                    >
                      {importerOpen ? (
                        <>
                          <X className="h-3.5 w-3.5" />
                          <span>إغلاق الاستيراد</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>استيراد ملف جرد</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Professional Fuzzy Search Input */}
                <div className="relative">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم الصنف أو القسم فقط..."
                    className="w-full bg-slate-50 border border-slate-200 outline-none rounded-xl pr-10 pl-9 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
                    id="search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition-all z-10 cursor-pointer"
                      title="مسح البحث"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Stats indicators */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
                  <span>جملة البنود المسجلة: <strong className="text-slate-900 font-mono">{items.length}</strong></span>
                  {searchQuery && (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      طابق البحث: <strong className="font-mono">{filteredItems.length}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Sidebar List Component */}
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col min-h-0">
                {itemsLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-7 w-7 text-emerald-600 animate-spin mb-2" />
                    <span className="text-xs text-slate-400">تحميل الأصناف والربط السحابي...</span>
                  </div>
                ) : itemsError ? (
                  <div className="flex-1 p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                    <p className="text-xs text-rose-700 font-semibold">{itemsError}</p>
                  </div>
                ) : items.length === 0 ? (
                  /* Empty state for fresh dashboard */
                  <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
                    <Database className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600 font-display">لم يتم رفع أرشيفات جرد من قبل!</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed mx-auto">
                      ابدأ برفع ملف CSV للجرد اليومي وسيتم ترتيب وجدولة البيانات تلقائياً.
                    </p>
                    <button
                      onClick={() => {
                        setImporterOpen(true);
                        setSelectedItem(null);
                        setSelectedRecord(null);
                      }}
                      className="mt-4 inline-flex items-center bg-slate-950 hover:bg-slate-900 text-white font-medium text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 ml-1.5" />
                      <span>استيراد ملف CSV</span>
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  /* Filtered empty state */
                  <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
                    <HelpCircle className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">لا توجد نتائج مطابقة لبحثك</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">تأكد من كتابة الكلمات بشكل صحيح.</p>
                  </div>
                ) : (
                  /* Normal Items List */
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0" id="items-sidebar-list">
                    {filteredItems.map((item) => {
                      const isActive = selectedItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setSelectedRecord(null);
                            setImporterOpen(false);
                          }}
                          className={`p-4 transition-all duration-200 cursor-pointer text-right relative group ${
                            isActive 
                              ? 'bg-emerald-50 bg-opacity-20 border-r-4 border-emerald-600' 
                              : 'hover:bg-slate-50/70 border-r-4 border-transparent'
                          }`}
                          id={`item-sidebar-${item.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 leading-tight block truncate max-w-[220px]">
                                {item.name}
                              </h4>
                              <div className="flex items-center space-x-1.5 rtl:space-x-reverse mt-1">
                                {item.code && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-medium px-1 rounded truncate max-w-[80px]">
                                    {item.code}
                                  </span>
                                )}
                                {item.category && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded truncate max-w-[90px]">
                                    {item.category}
                                  </span>
                                )}
                                {item.latestLocation && (
                                  <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-100/40 font-medium px-1.5 py-0.5 rounded truncate max-w-[90px]">
                                    شلف {item.latestLocation}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Delete helper optionally */}
                            <button
                              onClick={(e) => handleDeleteItem(item, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="حذف الصنف نهائياً"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Secondary detailed row info on card */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-3 font-sans border-t border-dashed border-slate-100/70 pt-2 shrink-0">
                            <span className="truncate max-w-[140px]">آخر مدقق: <strong className="text-slate-600">{item.latestPerson || '-'}</strong></span>
                            <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                              رصيد: {item.latestQuantity ?? '-'} {item.latestUnit || ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Second Main Column: Detail Panes or Importer Panel */}
            <div className={`flex-1 flex flex-col min-h-0 ${!selectedItem && !importerOpen ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Default Welcome Screen */}
              {!selectedItem && !selectedRecord && !importerOpen && (
                <div className="h-full bg-white border border-slate-200 rounded-2xl shadow-2xs p-8 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full mb-4 animate-bounce">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-950 font-display">منصة الأرشفة والمطابقة "جردي"</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                    قم بإجراء بحث أو انقر على صنف في القائمة الجانبية لعرض تاريخ عمليات الجرد اليومية السابقة وتصفح تفاصيل ومستندات الإدخالات بدقة.
                  </p>
                  
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 max-w-sm w-full mt-6">
                    <h4 className="text-xs font-bold text-slate-700 text-right mb-2">تعليمات العمل السريع:</h4>
                    <ul className="text-[11px] text-slate-500 space-y-1 text-right list-disc list-inside">
                      <li>تأثير فوري لعمليات تصفية وفهرسة البنود.</li>
                      <li>القدرة على استخراج بقية الأعمدة المخصصة من الـ CSV مع تخزين سحابي.</li>
                      <li>تحميل بيانات افتراضية على الفور للاختبار.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Importer Panel */}
              {importerOpen && (
                <CsvImporter
                  userId={user.uid}
                  onImportComplete={() => {
                    setImporterOpen(false);
                    reloadData();
                  }}
                  existingItems={items}
                />
              )}

              {/* Item History view */}
              {selectedItem && !selectedRecord && !importerOpen && (
                <ItemHistory
                  item={selectedItem}
                  onSelectRecord={(rec) => setSelectedRecord(rec)}
                  onClose={() => setSelectedItem(null)}
                />
              )}

              {/* Detailed Database Record Page */}
              {selectedRecord && !importerOpen && (
                <RecordDetails
                  record={selectedRecord}
                  itemCode={selectedItem?.code}
                  itemCategory={selectedItem?.category}
                  onBack={() => setSelectedRecord(null)}
                />
              )}
            </div>

          </div>
        )}
      </main>

      {/* Custom Confirmation Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className={`p-3 rounded-full inline-flex mb-2 ${confirmState.isDanger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">{confirmState.title}</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {confirmState.message}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={confirmState.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm text-white ${
                  confirmState.isDanger ? 'bg-rose-600 hover:bg-rose-700 active:scale-95' : 'bg-amber-600 hover:bg-amber-700 active:scale-95'
                }`}
              >
                {confirmState.confirmText}
              </button>
              <button
                onClick={() => setConfirmState(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                {confirmState.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
