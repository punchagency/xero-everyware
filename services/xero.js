const { xeroClient, getStoredTenantId } = require('../middleware/auth');

/**
 * @module services/xero
 * @description Handles all Xero-related operations including creating invoices and processing payments
 */

/**
 * Creates an invoice in Xero and immediately applies a payment to it
 * @async
 * @function createAndPayInvoice
 * @param {Object} paymentData - The payment data received from Everyware
 * @param {string} paymentData.customerName - Name or identifier of the customer
 * @param {string} paymentData.description - Description of the service/product
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.tenantId - Xero tenant ID
 * @param {string} paymentData.reference - Payment reference number
 * @param {string} paymentData.paymentDate - Date of payment
 * @param {string} paymentData.paymentMethod - Method of payment (e.g., "VISA ending in 1234")
 * @returns {Promise<Object>} Object containing created invoice and payment details
 * @throws {Error} If invoice creation or payment application fails
 */

async function createAndPayInvoice(paymentData) {
    try {
        const storedTenantId = getStoredTenantId();
        if (!storedTenantId) {
            throw new Error('No Xero tenant ID found');
        }

        // Format dates properly
        const dateValue = new Date(paymentData.paymentDate).toISOString().split('T')[0];

        // Create invoice following Xero types exactly
        const invoice = {
            type: "ACCREC",
            contact: {
                name: paymentData.customerName
            },
            date: dateValue,
            dueDate: dateValue,
            lineItems: [{
                description: paymentData.description,
                quantity: 1.0,
                unitAmount: paymentData.amount,
                accountCode: "400",
                taxType: "NONE"
            }],
            reference: paymentData.reference,
            status: "AUTHORISED",
            lineAmountTypes: "Exclusive"
        };

        const invoices = {
            invoices: [invoice]
        };

        console.log('Creating invoice:', JSON.stringify(invoices, null, 2));
        console.log("Stored tenant ID", storedTenantId);
        const invoiceResponse = await xeroClient.accountingApi.createInvoices(
            storedTenantId,
            invoices,
            false,
            4
        );

        const createdInvoice = invoiceResponse.body.invoices[0];
        console.log('Invoice created:', JSON.stringify(createdInvoice, null, 2));

        // Check if invoice was created successfully
        if (createdInvoice.hasErrors || !createdInvoice.invoiceID || createdInvoice.invoiceID === "00000000-0000-0000-0000-000000000000") {
            throw new Error(`Invoice creation failed: ${JSON.stringify(createdInvoice.validationErrors)}`);
        }

        // Create payment following Xero types exactly
        const payment = {
            invoice: {
                invoiceID: createdInvoice.invoiceID  // Use the created invoice ID
            },
            account: {
                code: "090"  // Your bank account code
            },
            amount: paymentData.amount,
            date: dateValue,
            reference: paymentData.paymentMethod
        };

        console.log('Creating payment:', JSON.stringify(payment, null, 2));

        const paymentResponse = await xeroClient.accountingApi.createPayment(
            storedTenantId,
            payment  // Note: Don't wrap in a payments object for createPayment
        );

        console.log('Payment created:', JSON.stringify(paymentResponse.body, null, 2));

        return {
            invoice: createdInvoice,
            payment: paymentResponse.body
        };
    } catch (error) {
        console.error('Xero API Error:', error.response?.body || error);
        throw error;
    }
}

module.exports = {
    createAndPayInvoice
}; 