
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, X } from 'lucide-react';
import { ContractContents } from '@/components/ContractContents';

const ContractPreview = ({ isOpen, onClose, onConfirm, businessProfile, businessTypeConfig, projectInfo, lineItems, grandTotal, isGenerating }) => {
  const contractRef = useRef(null);
  const componentProps = { businessProfile, businessTypeConfig, projectInfo, lineItems, grandTotal };

  const handleConfirm = () => {
    onConfirm(contractRef.current);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AnimatePresence>
        {isOpen && (
          <DialogContent className="max-w-4xl w-full p-0 flex flex-col max-h-[90svh]">
            <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
              <DialogTitle className="text-2xl">Contract Preview</DialogTitle>
              <DialogDescription>
                Review the contract details below. Once confirmed, a PDF will be downloaded.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-grow overflow-y-auto bg-gray-200">
              <div className="py-8 px-4 flex justify-center min-h-full">
                 <div ref={contractRef} className="w-[8.5in] min-h-[11in] shadow-2xl bg-white mx-auto">
                    <ContractContents {...componentProps} />
                 </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-4 flex-shrink-0 border-t bg-background">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={isGenerating} className="w-full sm:w-auto">
                {isGenerating ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Generating...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Confirm & Download PDF</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export default ContractPreview;
