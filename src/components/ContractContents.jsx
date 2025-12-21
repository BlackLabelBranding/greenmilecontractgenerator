
import React from 'react';

export const ContractContents = ({ businessProfile, businessTypeConfig, projectInfo, lineItems, grandTotal }) => {
  const {
    clientName,
    clientAddress,
    projectName,
    projectAddress,
    serviceFrequency,
    lawnSize,
    startDate,
    endDate,
    paymentDown,
    paymentCompletion,
    notes,
    date,
  } = projectInfo;

  const downPaymentAmount = grandTotal * (parseFloat(paymentDown) / 100 || 0);
  const completionPaymentAmount = grandTotal * (parseFloat(paymentCompletion) / 100 || 0);

  return (
    <div className="bg-white text-black p-[1in] relative min-h-[11in]" style={{ fontFamily: 'sans-serif' }}>
      {/* Watermark Background Layer */}
      {businessProfile?.watermarkUrl ? (
        <div className="absolute inset-0 flex items-center justify-center z-0 overflow-hidden pointer-events-none">
          <img
            alt="Watermark"
            className="w-[65%] object-contain opacity-[0.08]"
            src={businessProfile.watermarkUrl}
          />
        </div>
      ) : null}
        
      {/* Content Layer */}
      <div className="relative z-10">
        <header className="flex justify-between items-start pb-8 border-b mb-8">
          <div>
            {businessProfile?.logoUrl ? (
              <img alt={`${businessProfile.businessName} Logo`} className="h-16 mb-4 object-contain" src={businessProfile.logoUrl} />
            ) : (
              <div className="mb-4">
                <div className="text-2xl font-bold text-gray-900">{businessProfile?.businessName || 'Business Name'}</div>
                {businessProfile?.tagline ? <div className="text-sm text-gray-600">{businessProfile.tagline}</div> : null}
              </div>
            )}

            {businessProfile?.tagline && businessProfile?.logoUrl ? (
              <p className="text-sm text-gray-600 -mt-2 mb-2">{businessProfile.tagline}</p>
            ) : null}

            {(businessProfile?.contactLines || []).map((line, idx) => (
              <p key={idx} className="text-sm text-gray-600">{line}</p>
            ))}
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold text-gray-800">SERVICE PROPOSAL</h1>
            <p className="text-sm text-gray-600">Date: {new Date(date).toLocaleDateString()}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="font-bold mb-2 text-gray-700">CLIENT</h2>
            <p className="text-gray-800">{clientName}</p>
            <p className="text-gray-800 whitespace-pre-wrap">{clientAddress}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold mb-2 text-gray-700">JOB</h2>
            <p className="text-gray-800">{projectName}</p>
            <p className="text-gray-800 whitespace-pre-wrap">{projectAddress || clientAddress}</p>
            {serviceFrequency ? <p className="text-gray-800">Frequency: {serviceFrequency}</p> : null}
            {lawnSize ? <p className="text-gray-800">Lawn Size: {lawnSize}</p> : null}
            {startDate ? <p className="text-gray-800">Start: {new Date(startDate).toLocaleDateString()}</p> : null}
            {endDate ? <p className="text-gray-800">End: {new Date(endDate).toLocaleDateString()}</p> : null}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold bg-gray-100 text-gray-800 p-2 rounded-t-md">SCOPE OF WORK</h2>
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-300">Description</th>
                <th className="p-2 text-right font-semibold text-gray-700 border border-gray-300">Quantity</th>
                <th className="p-2 text-left font-semibold text-gray-700 border border-gray-300">Unit</th>
                <th className="p-2 text-right font-semibold text-gray-700 border border-gray-300">Unit Price</th>
                <th className="p-2 text-right font-semibold text-gray-700 border border-gray-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(item => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="p-2 align-top border border-gray-300 text-gray-800 whitespace-pre-wrap">{item.description}</td>
                  <td className="p-2 text-right align-top border border-gray-300 text-gray-800">{item.quantity}</td>
                  <td className="p-2 align-top border border-gray-300 text-gray-800">{item.unit}</td>
                  <td className="p-2 text-right align-top border border-gray-300 text-gray-800">${parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="p-2 text-right align-top border border-gray-300 text-gray-800">${item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <div className="w-full sm:w-1/2 md:w-1/3">
              <div className="flex justify-between font-bold text-lg p-2 bg-gray-100 rounded-md">
                <span className="text-gray-800">Grand Total:</span>
                <span className="text-gray-800">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 text-gray-800">
          <div>
            <h2 className="font-bold mb-2 text-gray-700">SERVICE DETAILS</h2>
            <p><strong>Business Type:</strong> {businessTypeConfig?.label || 'Service'}</p>
            {serviceFrequency ? <p><strong>Frequency:</strong> {serviceFrequency}</p> : <p><strong>Frequency:</strong> As agreed</p>}
            {lawnSize ? <p><strong>Property / Lawn Size:</strong> {lawnSize}</p> : null}
          </div>
          <div>
            <h2 className="font-bold mb-2 text-gray-700">PAYMENT TERMS</h2>
            <p>{paymentDown || '0'}% Deposit: <strong>${downPaymentAmount.toFixed(2)}</strong></p>
            <p>{paymentCompletion || '100'}% Balance Due: <strong>${completionPaymentAmount.toFixed(2)}</strong></p>
          </div>
        </section>

        {notes && (
          <section className="mb-8">
            <h2 className="font-bold mb-2 text-gray-700">NOTES</h2>
            <p className="text-sm p-4 border rounded-md bg-gray-50 whitespace-pre-wrap text-gray-800">{notes}</p>
          </section>
        )}

        <footer className="text-center text-xs text-gray-500 pt-8 border-t mt-8 break-inside-avoid">
          <p>Thank you for your business! This proposal is valid for 30 days unless otherwise stated.</p>
          <p>Acceptance of this proposal signifies agreement to the terms and conditions outlined.</p>
        </footer>
      </div>
    </div>
  );
};
