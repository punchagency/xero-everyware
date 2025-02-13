const express = require('express');
const router = express.Router();
const { xeroClient, setTokenSet, setTenantId, requireXeroAuth } = require('../middleware/auth');

/**
 * @module routes/auth
 * @description Handles Xero OAuth2 authentication flow
 */

/**
 * @route GET /auth/xero
 * @description Initiates Xero OAuth2 authentication flow
 * @throws {Error} If authentication initialization fails
 */

// Initialize Xero OAuth flow
router.get('/xero', async (req, res) => {
    try {
        const consentUrl = await xeroClient.buildConsentUrl();
        res.redirect(consentUrl);
    } catch (error) {
        console.error('Xero Auth Error:', error);
        res.status(500).send('Authentication failed');
    }
});

/**
 * @route GET /auth/callback
 * @description Handles OAuth2 callback from Xero
 * @description Stores authentication tokens and retrieves tenant information
 * @throws {Error} If token exchange or tenant retrieval fails
 */

// Xero callback route
router.get('/callback', async (req, res) => {
    try {
        console.log('Callback URL:', req.url);
        const tokenSet = await xeroClient.apiCallback(req.url);

        // First set the token
        await xeroClient.setTokenSet(tokenSet);
        // Then store it
        setTokenSet(tokenSet);

        // Get and store tenant ID
        const tenants = await xeroClient.updateTenants();
        console.log("tenants", tenants);
        const demoCompany = tenants.find(tenant => tenant.tenantName.includes('Demo'));

        if (!demoCompany) {
            throw new Error('Demo Company not found in Xero tenants');
        }

        setTenantId(demoCompany.tenantId);
        console.log("tenant ID", demoCompany.tenantId);

        res.redirect('/auth/test');
    } catch (error) {
        console.error('Xero Callback Error:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).send('Authentication callback failed');
    }
});

/**
 * @route GET /auth/test
 * @description Test endpoint to verify Xero authentication
 * @requires requireXeroAuth middleware
 * @returns {Object} Authentication status and basic Xero account information
 */

// Test route to verify authentication
router.get('/test', requireXeroAuth, async (req, res) => {
    try {
        const response = await req.xeroClient.accountingApi.getContacts(req.xeroTenantId);
        res.json({
            message: 'Authentication successful',
            tenantId: req.xeroTenantId,
            contacts: response.body.contacts
        });
    } catch (error) {
        console.error('Test Route Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 