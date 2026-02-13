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
  const [businessProfile] = useState(() => loadBusinessProfile());

  const businessTypeConfig = useMemo(() => {
    return BUSINESS_TYPES[businessProfile.businessType] || BUSINESS_TYPES.lawn_care;
  }, [businessProfile.businessType]);

  // 🔥 UNIVERSAL UNIT OPTIONS (always available)
  const unitOptions = useMemo(() => {
    const base = businessTypeConfig?.unitOptions || [];

    const universalUnits = [
      'Install',
      'Per Project',
      'Per Visit',
      'Each',
      'Hour',
      'Sq Ft',
      'Linear Ft',
      'Yard'
    ];

    return Array.from(new Set([...universalUnits, ...base]));
  }, [businessTypeConfig]);

  const isLandscaping =
    (businessTypeConfig?.label || '').toLowerCase().includes('landscap');

  const getDefaultUnit = () =>
    isLandscaping ? 'Install' : 'Per Visit';

  const [projectInfo, setProjectInfo] = useState(() =>
    buildInitialProjectInfo(businessTypeConfig)
  );

  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      description: '',
      quantity: '',
      unit: getDefaultUnit(),
      unitPrice: '',
      total: 0
    }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setProjectInfo((prev) => ({
      ...buildInitialProjectInfo(businessTypeConfig),
      ...prev,
      date: prev.date || new Date().toISOString().split('T')[0],
    }));

    setLineItems((prev) =>
      prev.map((item) => ({
        ...item,
        unit: item.unit || getDefaultUnit(),
      }))
    );
  }, [businessTypeConfig]);

  const addLineItem = () => {
    const newId =
      lineItems.length > 0
        ? Math.max(...lineItems.map((item) => item.id)) + 1
        : 1;

    setLineItems([
      ...lineItems,
      {
        id: newId,
        description: '',
        quantity: '',
        unit: getDefaultUnit(),
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

    const missingRequired = requiredKeys.some(
      (k) => !String(projectInfo[k] || '').trim()
    );

    if (
      missingRequired ||
      lineItems.some((item) => !String(item.description || '').trim())
    ) {
      toast({
        title: 'Missing Information',
        description:
          'Please fill in all required fields (*) before generating the contract.',
        variant: 'destructive',
      });
      return;
    }

    setIsPreviewOpen(true);
  };

  const handleConfirmAndDownload = async (element) => {
    if (!element) return;

    setIsGenerating(true);

    try {
      await generateContractPDF(element, projectInfo, businessProfile);

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
          unit: getDefaultUnit(),
          unitPrice: '',
          total: 0,
        },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{businessProfile.businessName} - Proposal Generator</title>
      </Helmet>

      <div className="min-h-screen mobile-padding py-8">
        <div className="max-w-5xl mx-auto space-y-8">

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Scope of Work</h2>
              <Button onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">

                    <div className="md:col-span-5 space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item.id, 'description', e.target.value)
                        }
                        rows={1}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', e.target.value)
                        }
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label>Unit</Label>
                      <Select
                        value={item.unit}
                        onValueChange={(value) =>
                          updateLineItem(item.id, 'unit', value)
                        }
                      >
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
                        onChange={(e) =>
                          updateLineItem(item.id, 'unitPrice', e.target.value)
                        }
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Label>Total</Label>
                      <div className="h-10 px-3 py-2 bg-muted border rounded-md flex items-center text-sm font-medium">
                        ${item.total.toFixed(2)}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t text-right">
              <p className="text-3xl font-bold text-primary">
                ${calculateGrandTotal().toFixed(2)}
              </p>
            </div>
          </Card>

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
