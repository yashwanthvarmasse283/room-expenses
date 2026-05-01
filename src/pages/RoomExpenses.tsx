import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, Search, Download, ShoppingCart, ChevronDown, X, Sparkles, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enrichItems, buildLastPaidPriceMap, getTopFrequentItems, type RawExpense, type RawItem } from '@/lib/itemAnalytics';

const defaultCategories = ['Food', 'Water', 'Rent', 'Electricity', 'Internet', 'Misc'];

interface CartItem {
  groceryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

const RoomExpenses = () => {
  const { user, role, profile, isViewOnly } = useAuth();
  const isAdmin = role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidByManual, setPaidByManual] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [grocerySearch, setGrocerySearch] = useState('');
  const [newGroceryItem, setNewGroceryItem] = useState('');
  const [quickText, setQuickText] = useState('');

  const adminId = isAdmin ? profile?.id : profile?.admin_id;

  const { data: expenses = [] } = useQuery({
    queryKey: ['room_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('room_expenses').select('*').eq('admin_id', adminId).order('date', { ascending: false });
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['room_members_expenses', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('profiles').select('id, user_id, name').or(`id.eq.${adminId},admin_id.eq.${adminId}`).eq('approved', true);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: virtualMembers = [] } = useQuery({
    queryKey: ['virtual_roommates', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('virtual_roommates').select('*').eq('admin_id', adminId);
      return data ?? [];
    },
    enabled: !!adminId,
  });

  const { data: groceries = [], refetch: refetchGroceries } = useQuery({
    queryKey: ['groceries', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('groceries').select('*').eq('admin_id', adminId).order('name');
      return data ?? [];
    },
    enabled: !!adminId,
  });

  // For autosuggest / last-paid-price / frequent chips
  const { data: itemsHistory = [] } = useQuery({
    queryKey: ['expense_items_history', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const { data } = await supabase.from('expense_grocery_items').select('id, expense_id, item_name, quantity, unit_price');
      return (data ?? []) as RawItem[];
    },
    enabled: !!adminId,
  });

  // CHANGE 6: Filter virtual members for non-admin users
  const allMembers = useMemo(() => {
    const real = members.map((m: any) => ({ id: m.user_id || m.id, name: m.name, type: 'real' }));
    if (isAdmin) {
      const virtual = virtualMembers.map((v: any) => ({ id: v.id, name: v.name, type: 'virtual' }));
      return [...real, ...virtual];
    }
    return real;
  }, [members, virtualMembers, isAdmin]);

  // All members including virtual for budget calculations
  const allMembersForBudget = useMemo(() => {
    const real = members.map((m: any) => ({ id: m.user_id || m.id, name: m.name, type: 'real' }));
    const virtual = virtualMembers.map((v: any) => ({ id: v.id, name: v.name, type: 'virtual' }));
    return [...real, ...virtual];
  }, [members, virtualMembers]);

  const { data: budgetData } = useQuery({
    queryKey: ['daily_food_budget', adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data } = await supabase.from('profiles').select('daily_food_budget').eq('id', adminId).single();
      return data;
    },
    enabled: !!adminId,
  });

  const dailyFoodBudget = (budgetData as any)?.daily_food_budget ?? 120;

  const allCategories = useMemo(() => {
    const cats = new Set(defaultCategories);
    expenses.forEach((e: any) => { if (e.category) cats.add(e.category); });
    return Array.from(cats);
  }, [expenses]);

  const dailyFoodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (e.category?.toLowerCase() === 'food') {
        map[e.date] = (map[e.date] || 0) + Number(e.amount);
      }
    });
    return map;
  }, [expenses]);

  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      map[e.date] = (map[e.date] || 0) + Number(e.amount);
    });
    return map;
  }, [expenses]);

  useEffect(() => {
    if (!adminId) return;
    const channel = supabase
      .channel('room-expenses-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_expenses', filter: `admin_id=eq.${adminId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['room_expenses', adminId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminId, queryClient]);

  const resetForm = () => {
    setDate(''); setCategory('Food'); setCustomCategory(''); setAmount(''); setDescription(''); setPaidBy(''); setPaidByManual('');
    setEditingId(null); setCartItems([]); setNewGroceryItem(''); setGrocerySearch(''); setCartOpen(false);
    setQuickText('');
  };

  const getEffectiveCategory = () => category === '_custom' ? customCategory.trim() : category;
  const getEffectivePaidBy = () => paidBy === '_manual' ? paidByManual.trim() : (paidBy || profile?.name || '');

  // Categories that REQUIRE itemization
  const ITEM_REQUIRED_CATEGORIES = useMemo(() => new Set(['food', 'grocery', 'groceries']), []);
  const requiresItems = (cat: string) => ITEM_REQUIRED_CATEGORIES.has(cat.trim().toLowerCase());

  const cartTotal = useMemo(() => cartItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0), [cartItems]);

  // Auto-populate amount from cart total — strict: when cart has items, amount = cart total (no manual override)
  useEffect(() => {
    if (cartItems.length > 0) {
      setAmount(String(cartTotal));
    }
  }, [cartTotal, cartItems.length]);

  // Last paid price per item name (case-insensitive) — for autofill
  const enrichedHistory = useMemo(() => enrichItems(itemsHistory, expenses), [itemsHistory, expenses]);
  const lastPaidMap = useMemo(() => buildLastPaidPriceMap(enrichedHistory), [enrichedHistory]);
  const top5Frequent = useMemo(() => getTopFrequentItems(enrichedHistory, 5), [enrichedHistory]);

  const findGroceryByName = (name: string) =>
    groceries.find((g: any) => g.name.trim().toLowerCase() === name.trim().toLowerCase());

  const addToCart = (grocery: any) => {
    if (cartItems.some(ci => ci.groceryId === grocery.id)) return;
    const lastPaid = lastPaidMap[grocery.name.trim().toLowerCase()]?.unitPrice;
    const unitPrice = lastPaid ?? Number((grocery as any).default_price || 0);
    setCartItems(prev => [...prev, { groceryId: grocery.id, name: grocery.name, quantity: 1, unitPrice }]);
  };

  // One-tap quick-add: ensures the item exists in the grocery master list, then adds to cart
  const quickAddByName = async (name: string, opts?: { quantity?: number; unitPrice?: number }) => {
    if (!adminId) return;
    let grocery = findGroceryByName(name);
    if (!grocery) {
      const effAdminId = isAdmin ? profile!.id : profile!.admin_id!;
      const { data } = await supabase.from('groceries').insert({ admin_id: effAdminId, name: name.trim() }).select().single();
      if (data) { grocery = data; refetchGroceries(); }
    }
    if (!grocery) return;
    if (cartItems.some(ci => ci.groceryId === grocery.id)) return;
    const last = lastPaidMap[name.trim().toLowerCase()]?.unitPrice ?? 0;
    setCartItems(prev => [
      ...prev,
      {
        groceryId: grocery.id,
        name: grocery.name,
        quantity: opts?.quantity ?? 1,
        unitPrice: opts?.unitPrice ?? last,
      },
    ]);
  };

  // Quick-text parser: "milk 2 120" or "rice 5kg 250" or "milk 120" (qty defaults to 1)
  const parseAndAddQuickText = async () => {
    const raw = quickText.trim();
    if (!raw) return;
    // Match: name (letters/spaces) then optional qty (number) then price (number)
    const m = raw.match(/^([a-zA-Z][a-zA-Z\s]*?)\s+(?:(\d+(?:\.\d+)?)\s*[a-zA-Z]*\s+)?(\d+(?:\.\d+)?)\s*$/);
    if (!m) {
      toast({ title: 'Could not parse', description: 'Try: "milk 2 120" (item qty price) or "milk 120"', variant: 'destructive' });
      return;
    }
    const name = m[1].trim();
    const qty = m[2] ? Number(m[2]) : 1;
    const price = Number(m[3]);
    await quickAddByName(name, { quantity: qty, unitPrice: price });
    setQuickText('');
    setCartOpen(true);
  };

  const removeFromCart = (groceryId: string) => {
    setCartItems(prev => prev.filter(ci => ci.groceryId !== groceryId));
  };

  const updateCartItem = (groceryId: string, field: 'quantity' | 'unitPrice', value: number) => {
    setCartItems(prev => prev.map(ci => ci.groceryId === groceryId ? { ...ci, [field]: value } : ci));
  };

  const addGroceryItem = async () => {
    if (!newGroceryItem.trim() || !adminId) return;
    const effAdminId = isAdmin ? profile!.id : profile!.admin_id!;
    const { data, error } = await supabase.from('groceries').insert({ admin_id: effAdminId, name: newGroceryItem.trim() }).select().single();
    if (!error && data) {
      refetchGroceries();
      const last = lastPaidMap[data.name.trim().toLowerCase()]?.unitPrice ?? 0;
      // Auto-add to cart with last-paid-price if known
      setCartItems(prev => [...prev, { groceryId: data.id, name: data.name, quantity: 1, unitPrice: last }]);
      setNewGroceryItem('');
      toast({ title: 'Item added to grocery list & cart' });
    }
  };

  const filteredGroceries = useMemo(() => {
    if (!grocerySearch.trim()) return groceries;
    return groceries.filter((g: any) => g.name.toLowerCase().includes(grocerySearch.toLowerCase()));
  }, [groceries, grocerySearch]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isViewOnly) return;

    const effectiveCategory = getEffectiveCategory();
    if (!effectiveCategory) {
      toast({ title: 'Please enter a category name', variant: 'destructive' });
      return;
    }

    const effectivePaidBy = getEffectivePaidBy();

    if (!editingId) {
      const existingDailyTotal = dailyTotals[date] || 0;
      if (dailyFoodBudget > 0 && existingDailyTotal + Number(amount) > dailyFoodBudget * allMembersForBudget.length) {
        toast({ title: '⚠️ Daily spending limit exceeded.', description: `Total for ${date} will exceed the daily budget.`, variant: 'destructive' });
      }
      if (effectiveCategory.toLowerCase() === 'food') {
        const existingFoodTotal = dailyFoodTotals[date] || 0;
        if (existingFoodTotal + Number(amount) > dailyFoodBudget) {
          toast({ title: '⚠️ Daily food budget exceeded.', description: `Food budget for ${date}: ₹${dailyFoodBudget}`, variant: 'destructive' });
        }
      }
    }

    if (editingId) {
      const { error } = await supabase.from('room_expenses')
        .update({ date, category: effectiveCategory, amount: Number(amount), description, paid_by: effectivePaidBy })
        .eq('id', editingId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      // Update grocery items for edited expense
      await supabase.from('expense_grocery_items').delete().eq('expense_id', editingId);
      if (cartItems.length > 0) {
        await supabase.from('expense_grocery_items').insert(
          cartItems.map(ci => ({ expense_id: editingId, grocery_id: ci.groceryId, item_name: ci.name, quantity: ci.quantity, unit_price: ci.unitPrice }))
        );
      }
      toast({ title: 'Updated' });
    } else {
      const expAdminId = isAdmin ? profile.id : profile.admin_id!;
      const { data: inserted, error } = await supabase.from('room_expenses')
        .insert({ admin_id: expAdminId, date, category: effectiveCategory, amount: Number(amount), description, paid_by: effectivePaidBy, created_by_name: profile.name })
        .select('id')
        .single();
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      // Save itemized grocery data
      if (inserted && cartItems.length > 0) {
        await supabase.from('expense_grocery_items').insert(
          cartItems.map(ci => ({ expense_id: inserted.id, grocery_id: ci.groceryId, item_name: ci.name, quantity: ci.quantity, unit_price: ci.unitPrice }))
        );
      }
      await supabase.from('purse_transactions')
        .insert({ admin_id: expAdminId, type: 'outflow', amount: Number(amount), date, description: `Room: ${description || effectiveCategory}` });
      toast({ title: 'Added' });
    }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    queryClient.invalidateQueries({ queryKey: ['purse_transactions'] });
    setOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    if (isViewOnly) return;
    const { error } = await supabase.from('room_expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['room_expenses'] });
    toast({ title: 'Deleted' });
  };

  const startEdit = (exp: any) => {
    if (isViewOnly) return;
    setEditingId(exp.id); setDate(exp.date);
    if (defaultCategories.includes(exp.category)) {
      setCategory(exp.category);
      setCustomCategory('');
    } else {
      setCategory('_custom');
      setCustomCategory(exp.category);
    }
    setAmount(String(exp.amount)); setDescription(exp.description || '');
    const memberMatch = allMembers.find(m => m.name === exp.paid_by);
    if (memberMatch) {
      setPaidBy(exp.paid_by);
      setPaidByManual('');
    } else {
      setPaidBy('_manual');
      setPaidByManual(exp.paid_by || '');
    }
    setCartItems([]);
    setOpen(true);
  };

  const filtered = expenses.filter((e: any) => {
    const matchSearch = !search || (e.description || '').toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.category.toLowerCase() === filterCat.toLowerCase();
    return matchSearch && matchCat;
  });

  const monthlyTotal = expenses.filter((e: any) => {
    const d = new Date(e.date); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s: number, e: any) => s + Number(e.amount), 0);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((e: any) => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const getBudgetColor = (date: string) => {
    const foodTotal = dailyFoodTotals[date] || 0;
    if (foodTotal === 0) return '';
    return foodTotal > dailyFoodBudget ? 'border-l-4 border-l-destructive bg-destructive/5' : 'border-l-4 border-l-[hsl(var(--success))] bg-[hsl(var(--success))]/5';
  };

  const exportCsv = () => {
    const headers = ['Date', 'Category', 'Amount', 'Description', 'Paid By'];
    const rows = filtered.map((e: any) => [
      e.date, e.category, e.amount, e.description || '', e.paid_by || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `room-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filtered.length} expenses exported to CSV.` });
  };

  const canEdit = isAdmin && !isViewOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Room Expenses</h1>
          <p className="text-sm text-muted-foreground">Monthly total: ₹{monthlyTotal.toLocaleString()} · Food budget: ₹{dailyFoodBudget}/day</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />Export
          </Button>
          {!isViewOnly && (
            <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
                <form onSubmit={save} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Category</Label>
                      <Select value={category} onValueChange={v => { setCategory(v); if (v !== '_custom') setCustomCategory(''); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {defaultCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="_custom">✏️ Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                      {category === '_custom' && (
                        <Input placeholder="Enter custom category" value={customCategory} onChange={e => setCustomCategory(e.target.value)} className="mt-2" required />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                    <div className="space-y-2">
                      <Label>Paid By</Label>
                      <Select value={paidBy} onValueChange={v => { setPaidBy(v); if (v !== '_manual') setPaidByManual(''); }}>
                        <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                        <SelectContent>
                          {allMembers.map(m => (
                            <SelectItem key={m.id} value={m.name}>{m.name}{m.type === 'virtual' ? ' (V)' : ''}</SelectItem>
                          ))}
                          <SelectItem value="_manual">✏️ Enter manually...</SelectItem>
                        </SelectContent>
                      </Select>
                      {paidBy === '_manual' && (
                        <Input placeholder="Enter name" value={paidByManual} onChange={e => setPaidByManual(e.target.value)} className="mt-2" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>

                  {/* Cart-style Grocery Items */}
                  <Collapsible open={cartOpen} onOpenChange={setCartOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          Items Purchased ({cartItems.length})
                          {cartTotal > 0 && <span className="text-xs text-muted-foreground">· ₹{cartTotal}</span>}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${cartOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3">
                      {/* Search & select groceries */}
                      <Input
                        placeholder="Search grocery items..."
                        value={grocerySearch}
                        onChange={e => setGrocerySearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                       <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {filteredGroceries.filter((g: any) => g.active !== false).map((g: any) => {
                          const inCart = cartItems.some(ci => ci.groceryId === g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => !inCart && addToCart(g)}
                              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${inCart ? 'bg-primary text-primary-foreground border-primary opacity-60 cursor-default' : 'bg-muted/50 text-foreground border-border hover:bg-muted cursor-pointer'}`}
                            >
                              {g.name} {inCart && '✓'}
                            </button>
                          );
                        })}
                        {filteredGroceries.length === 0 && <p className="text-xs text-muted-foreground">No items found.</p>}
                      </div>

                      {/* Add missing item */}
                      <div className="flex gap-2">
                        <Input placeholder="Add missing item..." value={newGroceryItem} onChange={e => setNewGroceryItem(e.target.value)} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroceryItem(); } }} />
                        <Button type="button" size="sm" variant="outline" onClick={addGroceryItem} className="h-8">Add</Button>
                      </div>

                      {/* Cart items with qty & price */}
                      {cartItems.length > 0 && (
                        <div className="border border-border rounded-lg divide-y divide-border">
                          <div className="grid grid-cols-[1fr_60px_80px_60px_28px] gap-1 px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">
                            <span>Item</span><span>Qty</span><span>Price (₹)</span><span>Total</span><span></span>
                          </div>
                          {cartItems.map(ci => (
                            <div key={ci.groceryId} className="grid grid-cols-[1fr_60px_80px_60px_28px] gap-1 px-2 py-1.5 items-center">
                              <span className="text-sm text-foreground truncate">{ci.name}</span>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={ci.quantity}
                                onChange={e => updateCartItem(ci.groceryId, 'quantity', Math.max(0, Number(e.target.value)))}
                                className="h-7 text-xs px-1.5"
                              />
                              <Input
                                type="number"
                                min={0}
                                value={ci.unitPrice || ''}
                                onChange={e => updateCartItem(ci.groceryId, 'unitPrice', Number(e.target.value))}
                                className="h-7 text-xs px-1.5"
                                placeholder="₹"
                              />
                              <span className="text-xs font-medium text-foreground">₹{(ci.quantity * ci.unitPrice).toLocaleString()}</span>
                              <button type="button" onClick={() => removeFromCart(ci.groceryId)} className="text-muted-foreground hover:text-destructive">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <div className="flex justify-between px-2 py-2 bg-muted/50 font-medium text-sm">
                            <span>Cart Total</span>
                            <span>₹{cartTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Button className="w-full" type="submit">{editingId ? 'Update' : 'Add'} Expense</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {groupedByDate.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No expenses found.</CardContent></Card>
        ) : groupedByDate.map(([dateKey, items]) => (
          <div key={dateKey} className={`rounded-lg p-3 ${getBudgetColor(dateKey)}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{dateKey}</p>
              {dailyFoodTotals[dateKey] > 0 && (
                <p className={`text-xs font-medium ${dailyFoodTotals[dateKey] > dailyFoodBudget ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                  Food: ₹{dailyFoodTotals[dateKey].toLocaleString()} / ₹{dailyFoodBudget}
                </p>
              )}
            </div>
            <div className="space-y-2">
              {items.map((e: any) => (
                <Card key={e.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{e.description || e.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{e.category}</span>
                      </div>
                      {e.paid_by && <p className="text-xs text-muted-foreground mt-0.5">Paid by {e.paid_by}</p>}
                      {(e as any).created_by_name && (e as any).created_by_name !== e.paid_by && (
                        <p className="text-[10px] text-muted-foreground">Added by {(e as any).created_by_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">₹{Number(e.amount).toLocaleString()}</span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomExpenses;
