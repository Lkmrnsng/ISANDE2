//Import Models
const User = require('../models/User');
const Request = require('../models/Request');
const Order = require('../models/Order');
const Item = require('../models/Item');
const { createAlertNoMsg } = require('./alertController');

// Render the marketplace catalog page
async function getCatalog(req, res) {
    try {
        const items = await Item.find({});
        const availableArray = await getAvailableStocks(items);
        
        res.render('marketplace_catalog', {
            title: "Catalog",
            css: ["marketplace_catalog.css", "marketplace.css"],
            layout: "marketplace",
            user: req.user || null,
            items: availableArray
        });
    } catch(err) {
        console.error('Error fetching items:', err);
    }
}

// Render the marketplace checkout page
async function getCheckout(req, res) {
    const user = await User.findOne({ _id: req.user._id });
    const addresses = await getAddresses(req.user);

    res.render('marketplace_checkout', {
        title: 'Checkout',
        css: ['marketplace_checkout.css', "marketplace.css"],
        layout: 'marketplace',
        user: user || null,
        addresses: addresses
    });
}

// Function to fetch addresses of all the user's order history
async function getAddresses(user) {
    try {
        const userID = user.userID || null;
        const requests = await Request.find({ customerID: userID });
        let orders = [];
        let addresses = [];

        for (const request of requests) {
            const order = await Order.find({ requestID: request.requestID });
            if (order) orders.push(order);
        }

        for (const request of orders) {
            for (const order of request) {
                const address = order.deliveryAddress;

                if (!addresses.includes(address.trim())) {
                    addresses.push(address.trim());
                }
            }
        }

        return addresses;
    } catch (error) {
        console.log(error);
        return [];
    }
}

async function getAvailableStocks(items) {
    const preparingOrders = await Order.find({ status: "Preparing" });
    const availableArray = [];
    let reservedStock = 0;

    for (const item of items) {
        for (const order of preparingOrders) {
            for (const orderItem of order.items) {
                if (orderItem.itemID == item.itemID) {
                    reservedStock += orderItem.quantity;
                }
            }
        }

        availableArray.push({
            itemID: item.itemID,
            itemName: item.itemName,
            itemDescription: item.itemDescription,
            itemImage: item.itemImage,
            itemPrice: item.itemPrice,
            itemStock: item.itemStock - reservedStock
        });

        reservedStock = 0;
    }

    return availableArray;
}

async function submitRequest(req, res) {
    try {
        const {
            address,
            name,
            formattedContact,
            dates,
            batch,
            customization,
            payment,
            cartItem,
          } = req.body;

        const request = await createRequest(name, formattedContact);
        const orders = await createOrder(request, cartItem, address, dates, batch, customization, payment);

        // Create alert after both request and orders are created
        if (request && orders.length > 0) {
            await createRequestAlert(request, request.customerID);
        }

        res.status(200).json({ request: request, orders: orders });
    } catch (err) {
        console.error('Error saving to db:', err);
        res.status(500).json({ error: 'Failed to save to db' });
    }
}

async function createRequestAlert(request, customerID) {
    try {
        const customer = await User.findOne({ userID: customerID });
        const restaurant = customer.restaurantName || customer.name;
        
        // Get all orders associated with this request
        const orders = await Order.find({ requestID: request.requestID });
        const orderIds = orders.map(order => order.OrderID);
        
        await createAlertNoMsg({
            category: 'Reminder',
            details: `New request received from ${restaurant}`,
            orders: orderIds,
            createdById: customerID,
        });
    } catch (error) {
        console.error('Error creating request alert:', error);
    }
}

async function createRequest(name, contact) {
    try {
        
        const latestRequest = await Request.findOne().sort({ requestID: -1 });
        const requestID = latestRequest ? parseInt(latestRequest.requestID) + 1 : 30001;
        const customerID = await getCustomerID(name, contact);
        const pointPersonID = await getSalesInCharge();
        const today = new Date();
        const requestDate = today.toISOString();
                
        const request = await Request.create({
            requestID: requestID,
            customerID: customerID,
            status: "Received",
            pointPersonID: pointPersonID,
            requestDate: requestDate,
            });

        return request;
    } catch (error) {
        console.error('Error in createRequest:', error);
        return null;
    }
}

async function createOrder(request, cartItem, address, dates, batch, customization, payment) {
    try {
        const latestOrder = await Order.findOne().sort({ OrderID: -1 });
        let orderID = latestOrder ? parseInt(latestOrder.OrderID) + 1 : 40001;
        const orders = [];
        const formattedItems = [];

        for (item of cartItem) {
            const itemName = item.itemName;
            const itemPrice = item.itemPrice;
            const foundItem = await Item.findOne({ itemName: itemName, itemPrice: itemPrice });
            formattedItems.push({
                itemID: foundItem.itemID,
                quantity: item.quantity
            });
        }

        for (date of dates) {
            const order = await Order.create({
                OrderID: orderID,
                requestID: request.requestID,
                status: "Waiting Approval",
                items: formattedItems,
                customizations: customization,
                deliveryDate: date,
                deliveryAddress: address,
                deliveryTimeRange: batch,
                pointPersonID: request.pointPersonID,
                paymentMethod: payment
            });

            if(order) orders.push(order);
            orderID++;
        }

        return orders;
    } catch (error) {
        console.error('Error in createOrder:', error);
        return [];
    }
}

async function getSalesInCharge() {
    try {
        const salesUsers = await User.find({ usertype: "Sales" });
        const handledOrders = []; // A 2D array: Sales ID and their corresponding number of orders handled
        let minIndex = 0;

        for (salesUser of salesUsers) {
            const salesID = salesUser.userID;
            const numOrders = await Order.countDocuments({ pointPersonID: salesID });
            handledOrders.push([salesID, numOrders]);
        }

        for (i = 0; i < handledOrders.length; i++) {
            if (handledOrders[i][1] < handledOrders[minIndex][1]) {
                minIndex = i;
            }
        }

        return handledOrders[minIndex][0];
    } catch (error) {
        console.error('Error in getSalesInCharge:', error);
        return null;
    }
}

async function getCustomerID(name, contact) {
    try {
        const customer = await User.findOne({ name: name, phone: contact });
        return customer.userID;
    } catch (error) {
        console.error('Error in getCustomerID:', error);
        return null;
    }
}

// Export Functions
module.exports = {
    getCatalog,
    getCheckout, 
    submitRequest,
    getSalesInCharge,
    getCustomerID,
    createRequest,
    createOrder,
};