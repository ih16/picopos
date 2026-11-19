import type { OrderStatus, WorkbookData } from './workbook';

// USD lifestyle shop; only demand follows Bangladesh's 2026 Eid calendar.
// Holiday anchors: https://www.britishcouncil.org.bd/sites/default/files/british_council_bangladesh_holiday_list_for_2026_0.pdf
const EID_DATES = ['2026-03-21', '2026-05-28'];
const DAY = 86_400_000;
const CATALOG = [
  {
    name: 'Bags',
    price: 28,
    options: ['Natural', 'Ink'],
    names: [
      'Market Tote',
      'Canvas Weekender',
      'Everyday Crossbody',
      'Zip Pouch',
      'Lunch Tote',
      'Rolltop Backpack',
      'Mini Sling',
      'Grocery Bag Set',
      'Laptop Sleeve',
      'Travel Organizer',
      'Drawstring Gym Bag',
      'Canvas Messenger',
    ],
  },
  {
    name: 'Drinkware',
    price: 18,
    options: ['Sage', 'Cream'],
    names: [
      'Stacking Mug',
      'Espresso Cup Set',
      'Travel Tumbler',
      'Glass Water Bottle',
      'Stoneware Tea Cup',
      'Cold Brew Carafe',
      'Enamel Camp Mug',
      'Ribbed Juice Glasses',
      'Insulated Flask',
      'Tea Infuser Bottle',
      'Ceramic Pitcher',
      'Coaster Set',
    ],
  },
  {
    name: 'Kitchen',
    price: 24,
    options: ['Natural', 'Charcoal'],
    names: [
      'Linen Apron',
      'Cotton Tea Towels',
      'Bamboo Cutting Board',
      'Wooden Serving Spoons',
      'Bread Basket',
      'Oven Mitt Pair',
      'Pantry Jar Set',
      'Salt Cellar',
      'Ceramic Utensil Crock',
      'Reusable Food Wraps',
      'Measuring Spoon Set',
      'Pot Holder Set',
    ],
  },
  {
    name: 'Tableware',
    price: 22,
    options: ['Sand', 'Slate'],
    names: [
      'Dinner Plate Pair',
      'Breakfast Bowl',
      'Pasta Bowl Pair',
      'Serving Platter',
      'Salad Plate Set',
      'Linen Napkin Set',
      'Woven Placemats',
      'Table Runner',
      'Dessert Plate Pair',
      'Dipping Bowl Set',
      'Wooden Salad Bowl',
      'Serving Tray',
    ],
  },
  {
    name: 'Home Textiles',
    price: 32,
    options: ['Oat', 'Olive'],
    names: [
      'Cotton Throw',
      'Waffle Blanket',
      'Cushion Cover',
      'Lumbar Pillow Cover',
      'Handwoven Rug',
      'Bath Mat',
      'Guest Towel Set',
      'Linen Pillowcase Pair',
      'Muslin Bed Throw',
      'Quilted Seat Pad',
      'Woven Floor Cushion',
      'Tea Towel Bundle',
    ],
  },
  {
    name: 'Home Fragrance',
    price: 20,
    options: ['Cedar', 'Citrus'],
    names: [
      'Soy Jar Candle',
      'Travel Tin Candle',
      'Reed Diffuser',
      'Room Spray',
      'Wax Melt Set',
      'Incense Cone Box',
      'Scented Drawer Sachets',
      'Mini Candle Trio',
      'Amber Glass Candle',
      'Diffuser Refill',
      'Botanical Sachet Set',
      'Ceramic Candle',
    ],
  },
  {
    name: 'Stationery',
    price: 12,
    options: ['Forest', 'Navy'],
    names: [
      'Everyday Notebook',
      'Weekly Planner',
      'Pocket Journal Set',
      'Desk Notepad',
      'Recipe Journal',
      'Address Book',
      'Sketchbook',
      'Bookmark Set',
      'Gift Tag Pack',
      'Greeting Card Set',
      'Pencil Case',
      'Travel Journal',
    ],
  },
  {
    name: 'Desk Accessories',
    price: 19,
    options: ['Oak', 'Walnut'],
    names: [
      'Desk Organizer',
      'Phone Stand',
      'Pen Tray',
      'Letter Rack',
      'Laptop Riser',
      'Cable Tidy Set',
      'Bookends',
      'Monitor Shelf',
      'Desk Storage Box',
      'Card Holder',
      'Memo Clip Stand',
      'Headphone Stand',
    ],
  },
  {
    name: 'Garden',
    price: 16,
    options: ['Terracotta', 'Stone'],
    names: [
      'Herb Planter',
      'Succulent Pot',
      'Window Box',
      'Seed Starter Tray',
      'Watering Can',
      'Plant Mister',
      'Hanging Planter',
      'Plant Label Set',
      'Propagation Vase',
      'Indoor Plant Pot',
      'Pot Saucer Set',
      'Garden Tool Caddy',
    ],
  },
  {
    name: 'Travel & Outdoors',
    price: 26,
    options: ['Moss', 'Black'],
    names: [
      'Picnic Blanket',
      'Packing Cube Set',
      'Luggage Tag Pair',
      'Travel Wallet',
      'Foldaway Shopper',
      'Waterproof Dry Bag',
      'Camp Cutlery Kit',
      'Travel Wash Bag',
      'Shoe Storage Bags',
      'Neck Pillow',
      'Compact Umbrella',
      'Picnic Cooler Bag',
    ],
  },
];

export function demoWorkbook(now = new Date()): WorkbookData {
  const data: WorkbookData = {
    Settings: [
      { id: 'businessName', value: 'Fieldwork Supply' },
      { id: 'currency', value: 'USD' },
      { id: 'schemaVersion', value: '1' },
      {
        id: 'shippingOptions',
        value: JSON.stringify([
          { id: 'standard', name: 'Standard shipping', rate: 5.95 },
          { id: 'pickup', name: 'Local pickup', rate: 0 },
        ]),
      },
    ],
    Categories: [],
    Customers: [],
    Products: [],
    Variants: [],
    Orders: [],
    'Order Items': [],
    Returns: [],
    'Stock Entries': [],
    'Purchase Lots': [],
  };
  let seed = 41827;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const money = (amount: number) => Math.round(amount * 100) / 100;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = end - 364 * DAY;
  const balances = new Map<string, number>();
  const suppliers = [
    'North Coast Textiles',
    'Stone & Clay Wholesale',
    'Oakline Housewares',
    'Paper Trail Supply',
    'Field & Fern Goods',
  ];
  const receipt = (variantId: string, quantity: number, date: number, opening = false) => {
    const variant = data.Variants.find((row) => row.id === variantId)!;
    const category = Math.floor(data.Variants.indexOf(variant) / 24);
    const supplier = suppliers[category % suppliers.length];
    const month = new Date(date).toISOString().slice(0, 7);
    const lotId = `lot-${month}-${category % suppliers.length}${opening ? '-opening' : ''}`;
    let lot = data['Purchase Lots'].find((row) => row.id === lotId);
    if (!lot) {
      lot = {
        id: lotId,
        name: `${supplier} · ${month}${opening ? ' opening inventory' : ' replenishment'}`,
        totalUnits: 0,
        totalAmount: 0,
      };
      data['Purchase Lots'].push(lot);
    }
    lot.totalUnits += quantity;
    lot.totalAmount = money(
      lot.totalAmount + quantity * money(variant.price * (0.4 + (category % 3) * 0.04)),
    );
    data['Stock Entries'].push({
      id: `stock-${data['Stock Entries'].length + 1}`,
      variantId,
      date: new Date(Math.min(date, now.getTime())).toISOString(),
      type: opening ? 'Opening stock' : 'Receipt',
      onHandDelta: quantity,
      unavailableDelta: 0,
      purchaseLotId: lotId,
      notes: opening ? 'Counted opening inventory at wholesale cost' : `Restock received from ${supplier}`,
    });
    balances.set(variantId, (balances.get(variantId) ?? 0) + quantity);
  };
  CATALOG.forEach((category, categoryIndex) => {
    const categoryId = `category-${categoryIndex + 1}`;
    data.Categories.push({ id: categoryId, name: category.name });
    category.names.forEach((name, index) => {
      const id = `product-${categoryIndex * 12 + index + 1}`;
      data.Products.push({
        id,
        name,
        categoryId,
        description: `${name} from the Fieldwork Supply ${category.name.toLowerCase()} collection.`,
        optionNames: categoryIndex === 5 ? 'Scent' : categoryIndex === 7 ? 'Finish' : 'Color',
        active: true,
      });
      category.options.forEach((option, optionIndex) => {
        const variantId = `${id}-${optionIndex + 1}`;
        data.Variants.push({
          id: variantId,
          productId: id,
          sku: `FW-${String(categoryIndex * 12 + index + 1).padStart(3, '0')}-${option.slice(0, 3).toUpperCase()}`,
          optionValues: option,
          price: category.price + (index % 5) * 4 + (index === 4 ? 12 : 0),
          active: true,
        });
        receipt(variantId, integer(5, 16), start - DAY, true);
      });
    });
  });
  const firstNames = [
    'Maya',
    'Alex',
    'Drew',
    'Jamie',
    'Olivia',
    'Noah',
    'Emma',
    'Liam',
    'Ava',
    'Ethan',
    'Sophia',
    'Lucas',
    'Isabella',
    'Mason',
    'Amelia',
    'Logan',
    'Harper',
    'Elijah',
    'Evelyn',
    'James',
  ];
  const lastNames = [
    'Chen',
    'Jordan',
    'Morgan',
    'Park',
    'Williams',
    'Johnson',
    'Davis',
    'Garcia',
    'Wilson',
    'Martinez',
    'Anderson',
    'Taylor',
    'Thomas',
    'Moore',
    'Jackson',
    'Lee',
    'Harris',
    'Clark',
    'Lewis',
    'Walker',
  ];
  const cities = [
    'Portland, OR 97205',
    'Seattle, WA 98103',
    'Austin, TX 78704',
    'Denver, CO 80206',
    'Brooklyn, NY 11201',
    'Chicago, IL 60614',
    'Boston, MA 02116',
    'San Diego, CA 92103',
  ];
  const streets = ['Maple Avenue', 'Oak Street', 'Cedar Lane', 'Pine Street', 'Willow Drive', 'Elm Avenue'];
  for (let i = 0; i < 320; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[(Math.floor(i / firstNames.length) + i) % lastNames.length];
    data.Customers.push({
      id: `customer-${i + 1}`,
      name: `${first} ${last}`,
      contact: `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@example.com`,
      address: `${integer(100, 9800)} ${streets[i % streets.length]}, ${cities[i % cities.length]}`,
      notes: i % 19 === 0 ? 'Prefers minimal packaging' : '',
      active: true,
    });
  }
  for (let day = 0; day < 365; day++) {
    const date = start + day * DAY;
    const age = 364 - day;
    let demand = 1;
    let campaign = '';
    EID_DATES.forEach((eid, index) => {
      const until = (Date.parse(`${eid}T00:00:00Z`) - date) / DAY;
      if (until >= 3 && until <= 30) {
        demand = (index === 0 ? 2.2 : 1.6) + (30 - until) / 16;
        campaign = index === 0 ? 'Eid-ul-Fitr promotion' : 'Eid-ul-Adha promotion';
      } else if (until < 3 && until >= -4) demand = 0.15;
      else if (until < -4 && until >= -10) demand = 0.6;
    });
    const weekday = new Date(date).getUTCDay();
    const count = Math.floor((1 + random() * 6) * demand * (weekday === 5 || weekday === 6 ? 1.15 : 1));
    // Review low stock weekly; larger buys before the busiest shopping weeks.
    if (day % 7 === 0) {
      for (const variant of data.Variants) {
        if (balances.get(variant.id)! < (campaign ? 8 : 4))
          receipt(variant.id, integer(campaign ? 16 : 8, campaign ? 30 : 16), date);
      }
    }
    // Occasional cycle-count corrections and damaged stock, never sales deductions.
    if (day % 9 === 0) {
      const variant = data.Variants[integer(0, data.Variants.length - 1)];
      if (balances.get(variant.id)! > 2) {
        const damaged = day % 18 === 0;
        const delta = damaged ? 0 : random() < 0.65 ? -1 : 1;
        data['Stock Entries'].push({
          id: `stock-${data['Stock Entries'].length + 1}`,
          variantId: variant.id,
          date: new Date(Math.min(date + 3600000, now.getTime())).toISOString(),
          type: damaged ? 'Damaged' : 'Adjustment',
          onHandDelta: delta,
          unavailableDelta: damaged ? 1 : 0,
          notes: damaged
            ? 'Packaging damage found during shelf inspection'
            : 'Monthly rotating cycle-count correction',
        });
        balances.set(variant.id, balances.get(variant.id)! + delta - (damaged ? 1 : 0));
      }
    }
    for (let n = 0; n < count; n++) {
      const roll = random();
      const status: OrderStatus =
        roll < 0.055
          ? 'Cancelled'
          : age === 0
            ? roll < 0.5
              ? 'Draft'
              : 'In progress'
            : age <= 2
              ? roll < 0.7
                ? 'In progress'
                : 'Shipped'
              : age <= 6
                ? roll < 0.8
                  ? 'Shipped'
                  : 'Completed'
                : 'Completed';
      const customer = data.Customers[Math.floor(Math.pow(random(), 1.65) * data.Customers.length)];
      const id = `order-${data.Orders.length + 1001}`;
      const orderTime = Math.min(date + integer(8 * 60, 22 * 60) * 60000, now.getTime());
      const order: WorkbookData['Orders'][number] = {
        id,
        number: `ORD-${data.Orders.length + 1001}`,
        createdAt: new Date(orderTime).toISOString(),
        customerId: customer.id,
        customer: customer.name,
        contact: customer.contact,
        address: customer.address,
        status,
        paymentStatus:
          status === 'Cancelled'
            ? random() < 0.35
              ? 'Refunded'
              : 'Unpaid'
            : status === 'Draft'
              ? 'Unpaid'
              : status === 'Completed' || random() < 0.72
                ? 'Paid'
                : 'Unpaid',
        notes: status === 'Cancelled' ? 'Customer cancelled before dispatch' : campaign,
        discount: 0,
        shippingCharge: 0,
        shippingOption: 'Standard shipping',
      };
      data.Orders.push(order);
      const lineCount = random() < 0.6 ? 1 : random() < 0.8 ? 2 : 3;
      const selected = new Set<string>();
      let subtotal = 0;
      for (let line = 0; line < lineCount; line++) {
        // A small bestseller group sells more often than the long-tail catalog.
        let variant = data.Variants[Math.floor(Math.pow(random(), 1.8) * data.Variants.length)];
        while (selected.has(variant.id)) variant = data.Variants[integer(0, data.Variants.length - 1)];
        selected.add(variant.id);
        const product = data.Products.find((row) => row.id === variant.productId)!;
        const quantity = random() < (campaign ? 0.25 : 0.12) ? integer(2, 3) : 1;
        if (status !== 'Draft' && status !== 'Cancelled') {
          if (balances.get(variant.id)! < quantity) receipt(variant.id, integer(8, 16), date + 2 * 3600000);
          balances.set(variant.id, balances.get(variant.id)! - quantity);
        }
        const item = {
          id: `${id}-item-${line + 1}`,
          orderId: id,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.optionValues,
          sku: variant.sku,
          quantity,
          unitPrice: variant.price,
        };
        data['Order Items'].push(item);
        subtotal += quantity * variant.price;
      }
      order.discount =
        campaign && random() < 0.65 ? money(subtotal * 0.1) : random() < 0.06 ? money(subtotal * 0.05) : 0;
      const pickup = random() < 0.12;
      order.shippingOption = pickup ? 'Local pickup' : 'Standard shipping';
      order.shippingCharge = pickup || subtotal - order.discount >= 75 ? 0 : 5.95;
    }
  }
  return data;
}
