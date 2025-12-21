// Business type schemas for the PDF generator.
// We’re shipping Lawn Care first (ASAP). This structure makes it easy to add more.

export const BUSINESS_TYPES = {
  lawn_care: {
    label: 'Lawn Care',
    unitOptions: [
      'Per Cut',
      'Per Visit',
      'Per Hour',
      'Square Foot',
      'Linear Foot',
      'Pieces',
    ],
    fields: {
      // Required
      projectName: { label: 'Job Name *', kind: 'text', required: true, placeholder: 'e.g., Weekly Lawn Service' },
      clientName: { label: 'Client Name *', kind: 'text', required: true, placeholder: 'Enter client name' },
      clientAddress: { label: 'Service Address *', kind: 'textarea', required: true, placeholder: 'Enter service address', rows: 1 },

      // Common lawn-care specifics
      serviceFrequency: { label: 'Service Frequency', kind: 'text', required: false, placeholder: 'e.g., Weekly / Bi-weekly' },
      lawnSize: { label: 'Lawn Size', kind: 'text', required: false, placeholder: 'e.g., Small / Medium / Large or Sq Ft' },
      startDate: { label: 'Start Date', kind: 'date', required: false },
      endDate: { label: 'End Date', kind: 'date', required: false },

      // Payments
      paymentDown: { label: 'Deposit %', kind: 'number', required: false, placeholder: 'Down %' },
      paymentCompletion: { label: 'Balance Due %', kind: 'number', required: false, placeholder: 'On completion %' },

      // Notes
      notes: { label: 'Notes', kind: 'textarea', required: false, placeholder: 'Add any notes here...', rows: 2 },

      // Meta
      date: { label: 'Proposal Date', kind: 'date', required: false },
    },
  },
};

export const DEFAULT_BUSINESS_TYPE = 'lawn_care';
