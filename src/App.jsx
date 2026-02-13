import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, FileSignature, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ContractPreview from '@/components/ContractPreview';
import { generateContractPDF } from '@/lib/pdfGenerator';
import { BUSINESS_TYPES } from '@/lib/businessTypes';
import { loadBusinessProfile } from '@/lib/businessProfile';

const buildInitialProjectInfo = (typeConfig) => {
  const info = {};
  Object.keys(typeConfig?.fields || {}).forEach((k) => {
    info[k] = '';
  });
  if ('date' in info) info.date = new Date().toISOString().split('T')[0];
  return info;
};

function App() {
  // Hard-coded profile now (your loadBusinessProfile returns the fixed profile)
  const [businessProfile] = useState(() => loadBusinessProfile());

  const businessTypeConfig = useMemo(() => {
    return BUSINESS_TYPES[businessProfile.businessType] || BUSINESS_TYPES.lawn_care;
  }, [businessProfile.businessType]);

  /**
   * ✅ ONLY CHANGE: ensure the Unit dropdown includes "Install" (and "Per Project")
   * while keeping your existing unitOptions order and behavior.
   */
  const unitOptions = useMemo(() => {
    const base = Array.isArray(businessTypeConfig?.unitOptions)
      ? businessTypeConfig.unitOptions
      : [];

    // Add only what you asked for
    const additions = ['Install', 'Per Project'];

    // Keep original order, append additions if missing
    const merged = [...base];
    additions.forEach((u) => {
      if (!merged.includes(u)) merged.push(u);
    });

    // If base was empty, fall back safely
    if (merged.length === 0) return ['Per Visit', 'Install', 'Per Project'];

    return merged;
  }, [businessTypeConfig]);

  const [projectInfo, setProjectInfo] = useState(() => buildInitialProjectInfo(businessTypeConfig));

  const [lineItems, setLineItems] = useState([
    { id: 1, description: '', quantity: '', unit: unitOptions[0] || 'Per Visit', unitPrice: '', total: 0 }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { toast } = useToast();

  // Business type is now hard-coded, but keep this effect to safely rebuild if fields change.
  useEffect(() => {
    setProjectInfo((prev) => ({
      ...buildInitialProjectInfo(businessTypeConfig),
      ...prev,
      date: prev.date || new Date().toISOString().split('T')[0],
    }));

    // Ensure unit defaults remain valid after changes
    setLineItems((prev) =>
      prev.map((item) => ({
        ...item,
        unit: item.unit || unitOptions[0] || 'Per Visit',
      }))
    );
  }, [businessTypeConfig, unitOptions]);

  const addLineItem = () => {
    const newId = lineItems.length > 0 ? Math.max(...lineItems.map((item) => item.id)) + 1 : 1;
    setLineItems([
      ...lineItems,
      {
        id: newId,
        description: '',
        quantity: '',
        unit: unitOptions[0] || 'Per Visit',
        unitPrice: '',
        total: 0,
      },
    ]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            const quantity = parseFloat(updatedItem.quantity) || 0;
            const unitPrice = parseFloat(updatedItem.unitPrice) || 0;
            updatedItem.total = quantity * unitPrice;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handlePreviewClick = () => {
    const requiredKeys = Object.entries(businessTypeConfig.fields)
      .filter(([, def]) => def.required)
      .map(([k]) => k);

    const missingRequired = requiredKeys.some((k) => !String(projectInfo[k] || '').trim());

    if (missingRequired || lineItems.some((item) => !String(item.description || '').trim())) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields (*) before generating the contract.',
        variant: 'destructive',
      });
      return;
    }

    setIsPreviewOpen(true);
  };

  const handleConfirmAndDownload = async (element) => {
    if (!element) {
      toast({
        title: 'Error Generating PDF',
        description: 'Contract content not found. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      await generateContractPDF(element, projectInfo, businessProfile);

      // Save contract data (optional – keep if you like the history feature)
      const grandTotal = calculateGrandTotal();
      const contractData = {
        projectInfo,
        lineItems,
        grandTotal,
        generatedAt: new Date().toISOString(),
      };

      const existingContracts = JSON.parse(localStorage.getItem('pdfgen_contracts_v1') || '[]');
      existingContracts.push(contractData);
      localStorage.setItem('pdfgen_contracts_v1', JSON.stringify(existingContracts));

      toast({
        title: 'Contract PDF Generated! 📄',
        description: 'Your proposal has been successfully downloaded.',
      });

      setIsPreviewOpen(false);
      setProjectInfo(buildInitialProjectInfo(businessTypeConfig));
      setLineItems([
        {
          id: 1,
          description: '',
          quantity: '',
          unit: unitOptions[0] || 'Per Visit',
          unitPrice: '',
          total: 0,
        },
      ]);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Error Generating PDF',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{businessProfile.businessName} - Proposal Generator</title>
        <meta name="description" content={`Branded PDF proposal generator for ${businessProfile.businessName}.`} />
      </Helmet>

      <div className="min-h-screen mobile-padding py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <motion.header
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {businessProfile.logoUrl ? (
                <div className="inline-block floating-animation">
                  <img
                    alt={`${businessProfile.businessName} Logo`}
                    className="h-20 mx-auto object-contain"
                    src={businessProfile.logoUrl}
                    crossOrigin="anonymous"
                  />
                </div>
              ) : null}
            </div>

            <h1 className="text-4xl font-bold gradient-text">{businessProfile.businessName}</h1>
            <p className="text-muted-foreground">{businessProfile.tagline || 'Branded Proposal Generator'}</p>
          </motion.header>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 glass-effect">
              <div className="flex items-center space-x-3 mb-6">
                <FileSignature className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold">Job Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(businessTypeConfig.fields).map(([key, def]) => {
                  const isNotes = key === 'notes';
                  const isAddress = key === 'clientAddress' || key === 'projectAddress';
                  const isDate = def.kind === 'date';

                  const colSpan = isNotes ? 'lg:col-span-3' : isAddress ? 'lg:col-span-2' : '';
                  const value = projectInfo[key] ?? '';
                  const onChange = (v) => setProjectInfo({ ...projectInfo, [key]: v });

                  // Payment agreement row
                  if (key === 'paymentDown') {
                    return (
                      <div key={key} className={`space-y-2 ${colSpan}`}>
                        <Label>Payment Agreement</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={projectInfo.paymentDown}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={businessTypeConfig.fields.paymentDown.placeholder || 'Deposit %'}
                          />
                          <Percent className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={projectInfo.paymentCompletion}
                            onChange={(e) => setProjectInfo({ ...projectInfo, paymentCompletion: e.target.value })}
                            placeholder={businessTypeConfig.fields.paymentCompletion.placeholder || 'Balance %'}
                          />
                        </div>
                      </div>
                    );
                  }

                  if (key === 'paymentCompletion') return null;

                  return (
                    <div key={key} className={`space-y-2 ${colSpan}`}>
                      <Label htmlFor={key}>
                        {def.label}
                        {def.required ? ' *' : ''}
                      </Label>

                      {def.kind === 'textarea' ? (
                        <Textarea
                          id={key}
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder={def.placeholder || ''}
                          rows={def.rows || 1}
                        />
                      ) : (
                        <Input
                          id={key}
                          type={isDate ? 'date' : def.kind === 'number' ? 'number' : 'text'}
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder={def.placeholder || ''}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 glass-effect">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-semibold">Scope of Work</h2>
                </div>
                <Button onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {lineItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-4 border rounded-lg bg-background/50"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5 space-y-2">
                          <Label>Description *</Label>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Work to be performed"
                            rows={1}
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                            placeholder="0"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label>Unit</Label>
                          <Select value={item.unit} onValueChange={(value) => updateLineItem(item.id, 'unit', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {unitOptions.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="md:col-span-1 flex items-end justify-between">
                          <div className="space-y-2 w-full">
                            <Label>Total</Label>
                            <div className="h-10 px-3 py-2 bg-muted border rounded-md flex items-center text-sm font-medium">
                              ${item.total.toFixed(2)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(item.id)}
                            disabled={lineItems.length === 1}
                            className="ml-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Grand Total</p>
                    <p className="text-3xl font-bold text-primary">${calculateGrandTotal().toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <Button
              onClick={handlePreviewClick}
              disabled={isGenerating}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 py-6 text-lg font-semibold pulse-glow"
            >
              <FileText className="w-5 h-5 mr-2" />
              Preview Contract
            </Button>
          </motion.div>
        </div>
      </div>

      <ContractPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmAndDownload}
        businessProfile={businessProfile}
        businessTypeConfig={businessTypeConfig}
        projectInfo={projectInfo}
        lineItems={lineItems}
        grandTotal={calculateGrandTotal()}
        isGenerating={isGenerating}
      />

      <Toaster />
    </>
  );
}

export default App;
