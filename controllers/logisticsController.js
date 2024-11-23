const Request = require('../models/Request');
const Order = require('../models/Order');
const Item = require('../models/Item');
const Procurement = require('../models/Procurement');
const Agency = require('../models/Agency');

// Fetch the logistics dashboard
async function getDashboardView(req, res) {
    try {
        const logisticsId = parseInt(req.session.userId); // Convert to number since userID is stored as number

        // Fetch requests for this logistics
        const originalRequests = await Request.find({ logisticsID: logisticsId }).sort({ requestID: -1 });
        
        if (originalRequests.length === 0) {
            return res.render('logistics_dashboard', {
                title: 'Dashboard',
                css: ['logisales_dashboard.css'],
                layout: 'logistics',
                requests: [],
                active: 'dashboard'
            });
        }

        const orderIDs = originalRequests.map(request => request.requestID);
        const orders = await Order.find({ requestID: { $in: orderIDs } });
        
        // Process the requests
        const processedRequests = await Promise.all(originalRequests.map(async (request) => {
            let deliveryDates = [];
            let deliveriesCount = 0;
            let totalItemsBreakdown = [];
            let itemNames = [];

            const requestOrders = orders.filter(order => order.requestID === request.requestID);

            for (const order of requestOrders) {
                if (order.deliveryDate) {
                    deliveryDates.push(order.deliveryDate);
                }
                deliveriesCount++;

                for (const item of order.items) {
                    const itemDetails = await Item.findOne({ itemID: item.itemID });
                    const itemIndex = totalItemsBreakdown.findIndex(i => i.itemID === item.itemID);
                    if (itemIndex === -1) {
                        totalItemsBreakdown.push({ 
                            itemID: item.itemID, 
                            quantity: item.quantity, 
                            itemName: itemDetails ? itemDetails.itemName : 'Unknown Item',
                            itemPrice: itemDetails ? itemDetails.itemPrice : 0
                        });
                        if (itemDetails) {
                            itemNames.push(itemDetails.itemName);
                        }
                    } else {
                        totalItemsBreakdown[itemIndex].quantity += item.quantity;
                    }
                }
            }

            return {
                requestID: request.requestID,
                requestDate: request.requestDate,
                deliveryDates,
                deliveriesCount,
                totalItemsBreakdown,
                itemNames
            };
        }));

        res.render('logistics_dashboard', {
            title: 'Dashboard',
            css: ['logistics_dashboard.css'],
            layout: 'logistics',
            requests: processedRequests,
            active: 'dashboard'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching logistics dashboard.");
    }
}

async function getCalendarView (req, res) {
    try {
        res.render('logistics_calendar', {
            title: 'Calendar',
            css: ['logistics_calendar.css'],
            layout: 'logistics',
            active: 'calendar'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching calendar.");
    }
}

//getFoodProcessView
async function getFoodProcessView (req, res) {
    try {
        res.render('logistics_foodprocess', {
            title: 'Food Process',
            css: ['logistics_foodprocess.css'],
            layout: 'logistics',
            active: 'foodprocess'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching food process.");
    }
}

//getDeliveryView
async function getDeliveryView (req, res) {
    try {
        res.render('logistics_delivery', {
            title: 'Delivery',
            css: ['logistics_delivery.css'],
            layout: 'logistics',
            active: 'delivery'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching delivery.");
    }
}

//getWarehouseView
async function getWarehouseView (req, res) {
    try {
        res.render('logistics_warehouse', {
            title: 'Warehouse',
            css: ['logistics_warehouse.css'],
            layout: 'logistics',
            active: 'warehouse'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching warehouse.");
    }
}

//getPartnersView
async function getPartnersView (req, res) {
    try {
        res.render('logistics_partners', {
            title: 'Partners',
            css: ['logistics_partners.css'],
            layout: 'logistics',
            active: 'partners'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching partners.");
    }
}

//getProcurementView
async function getProcurementView (req, res) {
    try {
        res.render('logistics_procurement', {
            title: 'Procurement',
            css: ['logistics_procurement.css'],
            layout: 'logistics',
            active: 'procurement'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching procurement.");
    }
}

//getSendAlertView
async function getSendAlertView (req, res) {
    try {
        res.render('logistics_sendalert', {
            title: 'Send Alert',
            css: ['logistics_sendalert.css'],
            layout: 'logistics',
            active: 'sendalert'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Error fetching send alert.");
    }
}

// Get the procurements data and return as a JSON
async function getProcurementJson(req, res) {
    try {
        const procurements = await getProcurementData();
        res.json(procurements);
    } catch (err) {
        console.error('Error fetching procurements:', err);
        res.status(500).json({ error: 'Failed to fetch procurements' });
    }
}

// Get the list of agencies for procurement dropdown as a JSON
async function getAgenciesJson(req, res) {
    try {
        const agencies = await getAgenciesData();
        res.json(agencies);
    } catch (err) {
        console.error('Error fetching agencies:', err);
        res.status(500).json({ error: 'Failed to fetch agencies' });
    }
}

// Get the list of items for procurement dropdown as a JSON
async function getItemsJson(req, res) {
    try {
        const items = await getItemsData();
        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
}

// Fetch procurements data by mapping across models
async function getProcurementData() {
    try {
        const procurements = await Procurement.find({}).sort({ incomingDate: -1 });
        const compiledData = [];
        
        for (const procurement of procurements) {
            // Get unique item IDs from both arrays
            const itemIDs = new Set([
                ...procurement.bookedItems.map(item => item[0]), // First element is itemID
                ...procurement.receivedItems.map(item => item[0])
            ]);

            // Fetch all required items in one query
            const items = await Item.find({ itemID: { $in: Array.from(itemIDs) } });
            const itemMap = new Map(items.map(item => [item.itemID, item]));

            const processedBookedItems = procurement.bookedItems.map(bookedItem => ({
                itemName: itemMap.get(bookedItem[0])?.itemName || 'Undefined',
                quantityShipping: bookedItem[1]
            }));

            const processedReceivedItems = procurement.receivedItems.map(receivedItem => ({
                itemName: itemMap.get(receivedItem[0])?.itemName || 'Undefined',
                quantityAccepted: receivedItem[1],
                quantityDiscarded: receivedItem[2]
            }));

            // Get agency information
            const agency = await Agency.findOne({ agencyID: procurement.agencyID });

            compiledData.push({
                procurementID: procurement.procurementID,
                agencyName: agency?.name || 'Undefined',
                incomingDate: procurement.incomingDate,
                receivedDate: procurement.receivedDate,
                bookedItems: processedBookedItems,
                receivedItems: processedReceivedItems,
                status: procurement.status
            });
        }

        return compiledData;
    } catch (error) {
        console.log("Error in getProcurementData: ", error);
    }
}

// Fetch agencies data from the db
async function getAgenciesData() {
    try {
        const agencies = await Agency.find({}).sort({ agencyID: 1 });
        const compiledData = [];
        
        for (const agency of agencies) {
            compiledData.push({
                agencyID: agency.agencyID,
                name: agency.name,
                contact: agency.contact,
                location: agency.location,
                price: agency.price,
                maxWeight: agency.maxWeight,
            });
        }

        return compiledData;
    } catch (err) {
        console.error('Error fetching agencies:', err);
    }
}

// Fetch items data from the db
async function getItemsData(req, res) {
    try {
        const items = await Item.find({}).sort({ itemID: 1 });
        const compiledData = [];
        
        for (const item of items) {
            compiledData.push({
                itemID: item.itemID,
                itemName: item.itemName,
                itemCategory: item.itemCategory,
                itemDescription: item.itemDescription,
                itemPrice: item.itemPrice,
                itemStock: item.itemStock,
                itemImage: item.itemImage
            });
        }

        return compiledData;
    } catch (err) {
        console.error('Error fetching items:', err);
    }
}

// Process the request to save the procurement to the db
async function submitProcurement(req, res) {
    try {
        const {
            agency,
            items,
            incomingDate
          } = req.body;

        const procurement = await createProcurement(agency, items, incomingDate);
        res.status(200).json({ procurement: procurement });
    } catch (err) {
        console.error('Error saving to db:', err);
        res.status(500).json({ error: 'Failed to save to db' });
    }
}

// Save procurement to db
async function createProcurement(agencyName, items, incomingDate) {
    try {
        const procurementID = await Procurement.countDocuments() + 60001;
        const agency = await Agency.findOne({ name: agencyName });
        const agencyID = agency.agencyID;
        const processedItems = await processItems(items);
        const formattedDate = incomingDate + "T00:00:00Z";
                
        const procurement = await Procurement.create({
            procurementID: procurementID,
            agencyID: agencyID,
            bookedItems: processedItems,
            receivedItems: [],
            incomingDate: formattedDate,
            receivedDate: "",
            status: "Booked"
        });

        return procurement;
    } catch (error) {
        console.error('Error in createProcurement:', error);
        return null;
    }
}

// Convert the items array into a 2d array of itemID, qty
async function processItems(items) {
    try {
        const itemQuantityMap = new Map();
        
        // Merge duplicates by adding quantities
        items.forEach(({item, quantity}) => {
            if (itemQuantityMap.has(item)) {
                itemQuantityMap.set(item, itemQuantityMap.get(item) + quantity);
            } else {
                itemQuantityMap.set(item, quantity);
            }
        });

        // Convert the merged items into an array of promises to get item IDs
        const itemPromises = Array.from(itemQuantityMap.entries()).map(async ([itemName, quantity]) => {
            const itemDoc = await Item.findOne({ itemName: itemName });
            if (!itemDoc) {
                throw new Error(`Item not found: ${itemName}`);
            }
            return [itemDoc.itemID, quantity];
        });

        const processedItems = await Promise.all(itemPromises);        
        return processedItems;
    } catch (error) {
        console.error('Error processing items:', error);
        throw error;
    }
}

module.exports = {
    getDashboardView,
    getCalendarView,
    getFoodProcessView,
    getDeliveryView,
    getWarehouseView,
    getPartnersView,
    getProcurementView,
    getSendAlertView,
    getProcurementJson,
    getAgenciesJson,
    getItemsJson,
    submitProcurement
};