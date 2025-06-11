// Main function to validate basket and apply applicable coupons
function validate_basket_helper(basket_validation_input) {
    
    // Destructure basket and coupons from input
    const { basket, coupons } = basket_validation_input;
    
    // Return default output if basket or coupons are missing
    if(!basket || !coupons) {
        return {
            discount_in_cents: 0,
            applied_coupons: []
        };
    }
    
    // Initialize basket validation output
    const basket_validation_output = {
        discount_in_cents: 0,
        applied_coupons: []
    };

    // Merge similar items in the basket to optimize processing
    let new_basket = mergeBasketItems(basket);
    let not_all_coupons_consumed = false;
    let index = 0;

    // for each coupon, check if basket meets requirements
    coupons.forEach(coupon => {
        index++;
        if(!coupon.purchase_requirement) {
            console.error("Coupon does not have purchase requirement");
            return;
        }
        
        // Calculate total basket price in cents
        let new_basket_total_price = 0;
        new_basket.map(item => {
            new_basket_total_price += item.price * item.quantity * 100;
        });

        // check if basket meets coupon requirements
        let {status, basket_items, units_to_purchase, units_to_purchase2, units_to_purchase3} = meets_requirements(new_basket, coupon);
        if(status) {
            const has_only_primary_purchase = !units_to_purchase2 && !units_to_purchase3;
            let discount_in_cents = get_discount_in_cents(coupon, basket_items, has_only_primary_purchase, new_basket_total_price, []);
            
            // Skip coupon if discount is not applicable
            if(discount_in_cents <= 0)
                return;
            const old_basket_units = basket_units(new_basket);
            
            // Reduce basket after applying coupon
            const reduced_basket = reduce_basket(new_basket, basket_items, {units_to_purchase, units_to_purchase2, units_to_purchase3});
            const consumed_basket = reduced_basket.consumed_basket;
            
            // Recalculate discount after basket reduction
            discount_in_cents = get_discount_in_cents(coupon, basket_items, has_only_primary_purchase, new_basket_total_price, consumed_basket);
            new_basket = reduced_basket.new_basket;
            
            const new_basket_units = basket_units(new_basket);
            
            // Add applied coupon details to the output
            basket_validation_output.applied_coupons.push({
                coupon_code: coupon.gs1,
                // description: coupon.description,
                face_value_in_cents: discount_in_cents,
                product_codes: get_product_codes(consumed_basket),
            });

            // Add discount to the total discount in cents
            if(discount_in_cents)
                basket_validation_output.discount_in_cents += discount_in_cents;

            // Check if all coupons were consumed
            if(new_basket_units === 0 && index < coupons.length) {
                not_all_coupons_consumed = true;
            }
        }
    });

    // Return the final output with validation results
    return {basket_validation_output, not_all_coupons_consumed};
}

// Calculate the discount for the coupon based on basket items
function get_discount_in_cents(coupon, basket_items, has_only_primary_purchase, new_basket_total_price, consumed_basket) {
    const save_value_code = coupon.purchase_requirement.save_value_code || 0;
    let applies_to_which_item = coupon.purchase_requirement.applies_to_which_item;
    if(has_only_primary_purchase && !applies_to_which_item)
        applies_to_which_item = 0;
    let discount_in_cents = 0;
    
    // Apply different discount calculation based on save_value_code
    if(save_value_code === 0) {
        discount_in_cents = coupon.purchase_requirement.primary_purchase_save_value;
        if(applies_to_which_item >= 0 || applies_to_which_item === undefined) {
            //coupon is not valid if total basket price is less than save value
            if(new_basket_total_price < discount_in_cents) {
                //discount_in_cents = qualifying_purchase_price;
                return -1;
            }
            let new_basket_items = applicable_basket_items(basket_items, applies_to_which_item);
            if(consumed_basket.length > 0) {
                // Filter basket items if consumed basket is provided
                new_basket_items = new_basket_items.filter((new_basket_item) => {
                    let found = false;
                    consumed_basket.map((consumed_basket_item) => {
                       if(consumed_basket_item.product_code === new_basket_item.product_code) {
                           found = true;
                       }
                    });
                    return found;
                    
                });
            }
            let qualifying_purchase_price = 0;
            new_basket_items.map(item => {
                qualifying_purchase_price += item.price * item.quantity * 100;
            });

            if(qualifying_purchase_price < discount_in_cents) {
                discount_in_cents = 0;
            }
            
            if(consumed_basket.length > 0) {
                let consumed_basket_price = 0;
                consumed_basket.map(item => {
                    consumed_basket_price += item.price * item.quantity * 100;
                });

                if(consumed_basket_price < discount_in_cents) {
                    discount_in_cents = 0;
                }
            }
        }
    } 
    // Handle different save value codes with appropriate logic
    else if (save_value_code === 1) {
        const max_amount_to_purchase = coupon.purchase_requirement.primary_purchase_save_value;
        let new_basket_items = applicable_basket_items(basket_items, applies_to_which_item);
        discount_in_cents = new_basket_items[0].price * 100;
        if(max_amount_to_purchase !== 0
            && discount_in_cents > max_amount_to_purchase) {
            discount_in_cents = max_amount_to_purchase;
        }
    } 
    // Handle free purchase of a certain number of items
    else if (save_value_code === 2) {
        const free_purchase_item_units = coupon.purchase_requirement.primary_purchase_save_value;
        let index = 0;
        basket_items.map(item => {
            if(applies_to_which_item === 0 && item.purchase_type) {
                return;
            }
            if(applies_to_which_item === 1 && item.purchase_type !== "second_purchase") {
                return;
            }
            if(applies_to_which_item === 2 && item.purchase_type !== "third_purchase") {
                return;
            }
            for(let i = 0; i < item.quantity; i++) {
                if(index < free_purchase_item_units) {
                    discount_in_cents += item.price * 100;
                    index++;
                }
            }
        });
    } 
    // Handle special cases based on save_value_code
    else if(save_value_code === 6) {
        discount_in_cents = coupon.purchase_requirement.primary_purchase_save_value;
    }
    return discount_in_cents;
}

// Helper function to get applicable basket items based on conditions
function applicable_basket_items(basket_items, applies_to_which_item) {
    let new_basket_items = [];
    if(applies_to_which_item === undefined) {
        new_basket_items = basket_items;
    } else if (applies_to_which_item === 0) {
        new_basket_items = basket_items.filter(item => !item.purchase_type);
    } else if(applies_to_which_item === 1) {
        new_basket_items = basket_items.filter(item => item.purchase_type === "second_purchase");
    } else if(applies_to_which_item === 2) {
        new_basket_items = basket_items.filter(item => item.purchase_type === "third_purchase");
    }
    return new_basket_items;
}

// Count total units in the basket
function basket_units(basket) {
    return basket.map(item => item.quantity).reduce((a, b) => a + b, 0);
}

// Reduce basket after consuming units based on coupon requirements
function reduce_basket(basket, allowed_basket_items, obj_units_to_purchase) {
    // let {units_to_purchase, units_to_purchase2, units_to_purchase3} = obj_units_to_purchase;
    const new_basket = [];
    const consumed_basket = [];
    basket.map(item => {
        let basket_item = {...item};
        let consumed_basket_item = {};
        let allowed_basket_item;
        for(const key_units_to_purchase of ["units_to_purchase", "units_to_purchase2", "units_to_purchase3"]) {
            const units_to_purchase = obj_units_to_purchase[key_units_to_purchase];
            // Check if units to purchase are greater than zero
            if(units_to_purchase > 0
                && basket_item.quantity > 0) {
                allowed_basket_item = allowed_basket_items_includes(allowed_basket_items, basket_item, key_units_to_purchase);
                // Update consumed and remaining basket items based on units to purchase
                if(allowed_basket_item) {
                    if(basket_item.quantity > units_to_purchase) {
                        consumed_basket_item = {
                            ...basket_item,
                            quantity: units_to_purchase
                        };
                        basket_item = {
                            ...basket_item,
                            quantity: basket_item.quantity - units_to_purchase
                        };
                        obj_units_to_purchase[key_units_to_purchase] = 0;
                    } else {
                        consumed_basket_item = {...basket_item};
                        obj_units_to_purchase[key_units_to_purchase] -= basket_item.quantity;
                        basket_item = {
                            ...basket_item,
                            quantity: 0
                        };
                    }
                    //from reusable purchase, reduce obj_units_to_purchase[key_units_to_purchase] by consumed_basket_item.quantity
                    if(allowed_basket_item.purchase_reuse) {
                        for(const key_units_to_purchase_other of ["units_to_purchase", "units_to_purchase2", "units_to_purchase3"]) {
                            if(key_units_to_purchase_other !== key_units_to_purchase && obj_units_to_purchase[key_units_to_purchase_other]) {
                                //find quantity of key_units_to_purchase_other already added
                                const allowed_basket_item_other = allowed_basket_items_includes(allowed_basket_items, consumed_basket_item, key_units_to_purchase_other);
                                if(allowed_basket_item_other?.quantity > 0) {
                                    let reduce_quantity_other = (obj_units_to_purchase[key_units_to_purchase_other] <= consumed_basket_item.quantity) ? obj_units_to_purchase[key_units_to_purchase_other] :  consumed_basket_item.quantity;
                                    reduce_quantity_other = (obj_units_to_purchase[key_units_to_purchase_other] <= reduce_quantity_other) ? obj_units_to_purchase[key_units_to_purchase_other] :  reduce_quantity_other;
                                    obj_units_to_purchase[key_units_to_purchase_other] -= reduce_quantity_other;
                                }
                            }
                        }
                    }
                }
            }
        }
        if(consumed_basket_item.quantity > 0)
            consumed_basket.push(consumed_basket_item);
        if(basket_item.quantity > 0)
            new_basket.push(basket_item);
    });
    return {consumed_basket, new_basket};
}

// Function to check if a given item is included in the allowed basket items
// It verifies the item based on product_code and purchase_type
function allowed_basket_items_includes(allowed_basket_items, item, key_units_to_purchase) {
    // Find the first matching allowed_basket_item based on conditions
    const allowed_basket_item = allowed_basket_items.find(allowed_basket_item => {
        
        // If checking for "units_to_purchase" and the item has a purchase_type, skip it
        if (key_units_to_purchase === "units_to_purchase" && allowed_basket_item.purchase_type) {
            return false; // Skip items with purchase_type for primary purchase
        }

        // If checking for "units_to_purchase2", ensure the purchase_type is "second_purchase"
        if (key_units_to_purchase === "units_to_purchase2" && allowed_basket_item.purchase_type !== "second_purchase") {
            return false; // Skip if purchase_type is not "second_purchase"
        }

        // If checking for "units_to_purchase3", ensure the purchase_type is "third_purchase"
        if (key_units_to_purchase === "units_to_purchase3" && allowed_basket_item.purchase_type !== "third_purchase") {
            return false; // Skip if purchase_type is not "third_purchase"
        }

        // Check if the product_code matches between allowed_basket_item and the provided item
        // NOTE: Optionally, price and unit can be matched here if needed (currently commented)
        return allowed_basket_item.product_code === item.product_code;
    });

    // Return the matched allowed_basket_item or undefined if no match found
    return allowed_basket_item;
}

// Function to extract product codes from basket items and group them by product type
function get_product_codes(basket_items) {
    // Initialize an empty object to store product codes categorized by type
    const product_codes = {};

    // Iterate over each item in the basket
    basket_items.map(item => {
        // Check if the item has a product_type
        if (!item.product_type) {
            // If product_type is not defined, add it under "gtins"
            product_codes.gtins = product_codes.gtins || []; // Create "gtins" array if not already present
            product_codes.gtins.push(item.product_code); // Add product_code to "gtins"
        } else {
            // If product_type is defined, categorize by product_type
            product_codes[item.product_type] = product_codes[item.product_type] || []; // Create array for product_type if not present
            product_codes[item.product_type].push(item.product_code); // Add product_code to respective product_type
        }
        // Return the product_code (optional since map is not used to generate a new array)
        return item.product_code;
    });

    // Return the final product_codes object with categorized product codes
    return product_codes;
}

function meets_requirements(basket, coupon) {
    if(!coupon.purchase_requirement) {
        console.error("Coupon does not have purchase requirement");
        return NEGATIVE_STATUS;
    }
    const { save_value_code: save_value_code1, applies_to_which_item, additional_purchase_rules_code} = coupon.purchase_requirement;
    const {primary_purchase, second_purchase, third_purchase} = get_purchases(coupon.purchase_requirement);
    // const save_value_code = save_value_code1 || 0;

    if(additional_purchase_rules_code === undefined || additional_purchase_rules_code === null) {
        let {status, basket_items, units_to_purchase} =  meets_purchase_requirements(coupon, basket, primary_purchase, true);
        // units_to_purchase += get_additional_units_to_purchase(basket_items, units_to_purchase, primary_purchase);
        return {status, basket_items, units_to_purchase};
    }
    else if (additional_purchase_rules_code === 0) {
        const purchases = [primary_purchase, second_purchase, third_purchase];
        const purchase_types = ["", "second_purchase", "third_purchase"];

        if (applies_to_which_item === undefined) {
            for (let basket_item of basket) {
                for (let i = 0; i < purchases.length; i++) {
                    const purchase = purchases[i];
                    if (purchase?.req_code !== undefined && purchase?.requirements !== undefined) {
                        let { status, basket_items, units_to_purchase } = meets_purchase_requirements(coupon, basket, purchase, true);
                        // Check if the current basket item is part of the basket_items that satisfy the condition
                        if (status && basket_items.some(item => item.product_code === basket_item.product_code)) {
                            // Calculate the total sum
                            const totalValue = basketValue(basket_items);
                            if(primary_purchase.save_value < totalValue) {
                                if (i > 0) {
                                    basket_items = basket_items?.map(item => ({
                                        ...item,
                                        purchase_type: purchase_types[i]
                                    }));
                                }
                                return {
                                    status,
                                    basket_items,
                                    ...(i === 0 && { units_to_purchase }),
                                    ...(i === 1 && { units_to_purchase2: units_to_purchase }),
                                    ...(i === 2 && { units_to_purchase3: units_to_purchase })
                                };
                            }  
                        }
                    }
                }
            }
        } else if (applies_to_which_item >= 0 && applies_to_which_item <= 2) {
            const purchase = purchases[applies_to_which_item];
            if (purchase?.req_code !== undefined && purchase?.requirements !== undefined) {
                let { status, basket_items, units_to_purchase } = meets_purchase_requirements(coupon, basket, purchase, true);
                if (status) {
                    if (applies_to_which_item > 0) {
                        basket_items = basket_items?.map(item => ({ ...item, purchase_type: purchase_types[applies_to_which_item] }));
                    }
                    // Dynamically assign correct units_to_purchase based on applies_to_which_item
                    return {
                        status,
                        basket_items,
                        ...(applies_to_which_item === 0 && { units_to_purchase }),
                        ...(applies_to_which_item === 1 && { units_to_purchase2: units_to_purchase }),
                        ...(applies_to_which_item === 2 && { units_to_purchase3: units_to_purchase })
                    };
                }
            }
        }
    } 
    else if (additional_purchase_rules_code === 1) {
        let basket_items1, units_to_purchase1;
        let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, primary_purchase, false);
        if(!status) {
            return NEGATIVE_STATUS;
        }
        basket_items1 = basket_items;
        units_to_purchase1 = units_to_purchase;

        let basket_items2, units_to_purchase2;
        if(second_purchase.req_code !== undefined && second_purchase.requirements !== undefined) {
            let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, second_purchase, false);
            if(!status) {
                return NEGATIVE_STATUS;
            }
            basket_items2 = basket_items;
            units_to_purchase2 = units_to_purchase;
        }

        let basket_items3, units_to_purchase3;
        if(third_purchase.req_code !== undefined && third_purchase.requirements !== undefined) {
            let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, third_purchase, false);
            if(!status) {
                return NEGATIVE_STATUS;
            }
            basket_items3 = basket_items;
            units_to_purchase3 = units_to_purchase;
        }
        basket_items2 = basket_items2?.map(item => {
            return {
                ...item,
                purchase_type: "second_purchase"
            };
        });
        basket_items3 = basket_items3?.map(item => {
            return {
                ...item,
                purchase_type: "third_purchase"
            };
        });
        const basket_items_final = reorderSubBasket(basket, basket_items1.concat(basket_items2 || []).concat(basket_items3 || []));
        // units_to_purchase1 += get_additional_units_to_purchase(basket_items_final, units_to_purchase1, primary_purchase);
        // units_to_purchase2 += get_additional_units_to_purchase(basket_items_final, units_to_purchase2, second_purchase);
        // units_to_purchase3 += get_additional_units_to_purchase(basket_items_final, units_to_purchase3, third_purchase);
        return {status: true,
            basket_items: basket_items_final,
            units_to_purchase: units_to_purchase1,
            units_to_purchase2: units_to_purchase2,
            units_to_purchase3: units_to_purchase3
        };
    } else if (additional_purchase_rules_code === 2) {
        let basket_items1, units_to_purchase1;
        let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, primary_purchase, false);
        if(!status) {
            return NEGATIVE_STATUS;
        }
        basket_items1 = basket_items;
        units_to_purchase1 = units_to_purchase;

        let status2, basket_items2, units_to_purchase2;
        if(second_purchase.req_code !== undefined && second_purchase.requirements !== undefined) {
            let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, second_purchase, false);
            status2 = status;
            basket_items2 = basket_items;
            units_to_purchase2 = units_to_purchase;
        }
        let status3, basket_items3, units_to_purchase3;
        if(third_purchase.req_code !== undefined && third_purchase.requirements !== undefined) {
            let {status, basket_items, units_to_purchase} = meets_purchase_requirements(coupon, basket, third_purchase, false);
            status3 = status;
            basket_items3 = basket_items;
            units_to_purchase3 = units_to_purchase;
        }
        if(status2) {
            basket_items2 = basket_items2?.map(item => {
                return {
                    ...item,
                    purchase_type: "second_purchase"
                };
            });
        } else if(status3) {
            basket_items3 = basket_items3?.map(item => {
                return {
                    ...item,
                    purchase_type: "third_purchase"
                };
            });
        } else {
            return NEGATIVE_STATUS;
        }

        const basket_items_final = reorderSubBasket(basket, basket_items1.concat(
            status2 ? basket_items2 : status3 ? basket_items3 : []
        ));
        // units_to_purchase1 += get_additional_units_to_purchase(basket_items_final, units_to_purchase1, primary_purchase);
        // if(status2)
        //     units_to_purchase2 += get_additional_units_to_purchase(basket_items_final, units_to_purchase2, second_purchase);
        // else if(status3)
        //     units_to_purchase3 += get_additional_units_to_purchase(basket_items_final, units_to_purchase3, third_purchase);
        return {status: true,
            basket_items: basket_items_final,
            units_to_purchase: units_to_purchase1,
            units_to_purchase2: units_to_purchase2,
            units_to_purchase3: units_to_purchase3
        };
    }
    return NEGATIVE_STATUS;
}

// Function to calculate additional units needed to meet the required purchase value
function get_additional_units_to_purchase(coupon, basket_items, units_to_purchase, purchase) {
    // Check if req_code is 0 (indicating a price-based requirement)
    if (purchase.req_code === 0) {
        let total_price_units_to_purchase = 0; // Total price of units added to purchase
        let count = 0; // Counter to track the number of units processed
        let additional_units_to_purchase = 0; // Track additional units required to satisfy conditions

        // Iterate through each item in the basket
        basket_items.map(item => {
            // Loop through each unit of the item (for quantities greater than 1)
            for (let i = 0; i < item.quantity; i++) {
                // Check if the count is less than the required units to purchase
                if (count < units_to_purchase) {
                    // Add the price of the current item (converted to cents) to the total
                    total_price_units_to_purchase += (item.price * 100);
                } else {
                    // If the total price is less than the required save value, add more units
                    if (coupon.purchase_requirement.primary_purchase_save_value > total_price_units_to_purchase) {
                        additional_units_to_purchase++; // Increment additional units required
                        total_price_units_to_purchase += (item.price * 100); // Add price of the extra unit
                    }
                }
                count++; // Increment the unit counter
            }
        });

        // Return the total number of additional units required
        return additional_units_to_purchase;
    }

    // Return 0 if req_code is not 0 (indicating no additional units needed)
    return 0;
}

// Function to check if the basket meets the purchase requirements
function meets_purchase_requirements(coupon, basket, purchase, apply_additional_units) {
    let units_to_purchase = 0; // Track number of required units

    // Case 1: Requirement is based on units to purchase (req_code === 0)
    if (purchase.req_code === 0) {
        units_to_purchase = purchase.requirements; // Get required units to purchase

        // Check if the basket has the required units
        const { status, basket_items } = basket_has_units_to_purchase(basket, units_to_purchase, purchase);

        // If additional units need to be applied, calculate and add them
        if (apply_additional_units) {
            units_to_purchase += get_additional_units_to_purchase(coupon, basket_items, units_to_purchase, purchase);
        }

        // Return the status, matching basket items, and total units to purchase
        return { status, basket_items, units_to_purchase };
    }

    // Case 2: Requirement is based on total transaction value (req_code === 1)
    else if (purchase.req_code === 1) {
        let cash_value_total_transaction = 0; // Track total cash value of transaction
        let units_to_purchase = 0; // Track the number of units purchased

        // Get allowed items from the basket that match purchase conditions
        const new_basket = allowed_basket(basket, purchase);

        // Loop through items to calculate total transaction value
        new_basket.map(item => {
            for (let i = 0; i < item.quantity; i++) {
                if (cash_value_total_transaction < purchase.requirements) {
                    cash_value_total_transaction += (item.price * 100); // Add item price in cents
                    units_to_purchase++;
                }
            }
        });

        // Check if the total transaction value meets the required amount
        const status = cash_value_total_transaction >= purchase.requirements;

        // Return status, allowed basket items, and total units purchased
        return { status, basket_items: new_basket, units_to_purchase };
    }

    // Case 3: Requirement is based on transaction value without exclusions (req_code === 2)
    else if (purchase.req_code === 2) {
        let cash_value_total_transaction = 0; // Track total cash value
        let units_to_purchase = 0; // Track the number of units purchased

        // Loop through all items in the basket
        basket.map(item => {
            for (let i = 0; i < item.quantity; i++) {
                if (cash_value_total_transaction < purchase.requirements) {
                    cash_value_total_transaction += (item.price * 100); // Add item price in cents
                    units_to_purchase++;
                }
            }
        });

        // Mark all basket items as reusable for purchase
        basket = basket?.map(item => {
            return {
                ...item,
                purchase_reuse: true,
            };
        });

        // Check if the total transaction value meets the requirement
        const status = cash_value_total_transaction >= purchase.requirements;

        // Return the status, updated basket, and total units purchased
        return { status, basket_items: basket, units_to_purchase };
    }

    // Return negative status if no conditions match
    return NEGATIVE_STATUS;
}

// Function to check if the basket has the required units to purchase
function basket_has_units_to_purchase(
    basket,
    units_to_purchase,
    { gtins, excluded_gtins, eans, excluded_eans, prefixed_code, excluded_prefixed_code }
) {
    // Get allowed items from the basket after applying exclusion rules
    const allowed_basket_items = allowed_basket(basket, {
        gtins,                // Allowed GTINs
        excluded_gtins,       // Excluded GTINs
        eans,                 // Allowed EANs
        excluded_eans,        // Excluded EANs
        prefixed_code,        // Allowed prefixed codes
        excluded_prefixed_code, // Excluded prefixed codes
    });

    // Calculate the total number of units purchased from allowed items
    const units_purchased = allowed_basket_items
        .map(item => item.quantity) // Get quantities of each item
        .reduce((a, b) => a + b, 0); // Sum up the quantities

    // Return status and allowed basket items
    return {
        status: units_purchased >= units_to_purchase, // Check if required units are met
        basket_items: allowed_basket_items,
    };
}

function allowed_basket(basket, {
    gtins, excluded_gtins,
    eans, excluded_eans,
    prefixed_code, excluded_prefixed_code
}) {
    const allowed_basket_items = basket.filter(item => {
        if ( !prefixed_code ) {
            return true;
        }
        const range = prefixed_code[item.product_type];
        const excluded_range = excluded_prefixed_code[item.product_type];
        if(excluded_range
            && item.product_code >= excluded_range.start
            && item.product_code <= excluded_range.end) {
            return false;
        }
        if(excluded_gtins?.includes(item.product_code)
            || excluded_eans?.includes(item.product_code)) {
            return false;
        }
        if(!gtins?.includes(item.product_code)
            && !eans?.includes(item.product_code)
            && !range) {
            return false;
        }
        if(range
            && (item.product_code < range.start
                || item.product_code > range.end)) {
            return false;
        }
        return true;
    });
    return allowed_basket_items;
}

// [
//   "PLU:mobispark.thecouponbureau.org:1001_1100",
//   "CLS:mobispark.thecouponbureau.org:1001_1100",
//   "DPT:mobispark.thecouponbureau.org:1001_1100",
//   "C_D:mobispark.thecouponbureau.org:1001_1100"
// ]
// transforms to
// {
//   "PLU": ["1001", "1100"],
//   "CLS": ["1001", "1100"],
//   "DPT": ["1001", "1100"],
//   "C_D": ["1001", "1100"],
// }
// function transform_prefixed_code(prefixed_code) {
//     if ( !Array.isArray(prefixed_code) ) {
//         return prefixed_code;
//     }
//     const output = {};
//     prefixed_code.map(code => {
//         if(code) {
//             const parts = code.split(":");
//             const range = parts[2].split("_");
//             output[parts[0]] = {
//                 start: range[0],
//                 end: range[1],
//             };
//         }
//     });
//     return output;
// }


// Function to transform a colon-separated string into an object with a key and range of values
function transformString(input) {
    // Split the input string by ":" to extract key and value parts
    let parts = input.split(":"); // Example: "PLU:mobispark.thecouponbureau.org:2001-2100"

    // Extract the first part (key), which will be used as the object property
    let key = parts[0]; // Example: "PLU"

    // Split the third part of the string (range) by "-" and convert the result to an array of strings
    let values = parts[2].split("-").map(String); // Example: ["2001", "2100"]

    // Return an object with the key and the corresponding range values
    // Example: { PLU: ["2001", "2100"] }
    return { [key]: values };
}

// Function to transform prefixed codes into a structured format
function transform_prefixed_code(prefixed_code) {
    // Check if prefixed_code is undefined or null
    if (!prefixed_code) {
        return []; // Return an empty array if no code is provided
    }

    // Check if prefixed_code is an array
    if (Array.isArray(prefixed_code)) {
        for (let i = 0; i < prefixed_code.length; i++) {
            let code = prefixed_code[i];

            // If the code is an object, return without modifying
            if (typeof code === 'object') {
                return;
            }

            // Check if the code contains a colon (":")
            if (code.indexOf(":") >= 0) {
                // If code contains a colon, transform it to a structured format
                // Example: "PLU:mobispark.thecouponbureau.org:2001_2100" -> {PLU: [2001, 2100]}
                code = transformString(code);
                // Update the current code in the array
                prefixed_code[i] = code;
            }
        }

        return prefixed_code; // Return the transformed array
    }

    // If prefixed_code is an object, transform its properties
    const output = {};
    for (let property in prefixed_code) {
        // Check if the property contains a colon (":")
        if (property.indexOf(":") >= 0) {
            // Transform property to a structured format
            property = transformString(property);
        }
        
        // Get the code associated with the property
        const code = prefixed_code[property];

        // If the code is defined, split and transform the range
        if (code) {
            const range = code[0].split("_");
            // Create a start and end range for the prefixed code
            output[property] = {
                start: range[0],
                end: range[1],
            };
        }
    }

    return output; // Return the transformed object
}

// Define a constant object for negative status response
const NEGATIVE_STATUS = {
    status: false, // Indicates failure or invalid status
};

// Define a constant object for positive status response
const POSITIVE_STATUS = {
    status: true, // Indicates success or valid status
};

// Function to retrieve and organize purchase requirements for primary, second, and third purchases
function get_purchases(purchase_requirement) {
    return {
        // Define primary purchase details
        primary_purchase: {
            save_value: purchase_requirement.primary_purchase_save_value, // Value to be saved for primary purchase
            requirements: purchase_requirement.primary_purchase_requirements, // List of purchase requirements
            req_code: purchase_requirement.primary_purchase_req_code, // Requirement code
            gtins: purchase_requirement.primary_purchase_gtins, // List of GTINs (Global Trade Item Numbers)
            eans: purchase_requirement.primary_purchase_eans, // List of EANs (European Article Numbers)
            excluded_gtins: purchase_requirement.excluded_primary_purchase_gtins, // List of excluded GTINs
            excluded_eans: purchase_requirement.excluded_primary_purchase_eans, // List of excluded EANs
            prefixed_code: transform_prefixed_code(purchase_requirement.primary_purchase_prefixed_code), // Transformed prefixed code
            excluded_prefixed_code: transform_prefixed_code(purchase_requirement.excluded_primary_purchase_prefixed_code), // Transformed excluded prefixed code
        },
        // Define second purchase details
        second_purchase: {
            save_value: purchase_requirement.second_purchase_save_value, // Value to be saved for second purchase
            requirements: purchase_requirement.second_purchase_requirements, // List of purchase requirements
            req_code: purchase_requirement.second_purchase_req_code, // Requirement code
            gtins: purchase_requirement.second_purchase_gtins, // List of GTINs for second purchase
            eans: purchase_requirement.second_purchase_eans, // List of EANs for second purchase
            excluded_gtins: purchase_requirement.excluded_second_purchase_gtins, // List of excluded GTINs
            excluded_eans: purchase_requirement.excluded_second_purchase_eans, // List of excluded EANs
            prefixed_code: transform_prefixed_code(purchase_requirement.second_purchase_prefixed_code), // Transformed prefixed code
            excluded_prefixed_code: transform_prefixed_code(purchase_requirement.excluded_second_purchase_prefixed_code), // Transformed excluded prefixed code
        },
        // Define third purchase details
        third_purchase: {
            save_value: purchase_requirement.third_purchase_save_value, // Value to be saved for third purchase
            requirements: purchase_requirement.third_purchase_requirements, // List of purchase requirements
            req_code: purchase_requirement.third_purchase_req_code, // Requirement code
            gtins: purchase_requirement.third_purchase_gtins, // List of GTINs for third purchase
            eans: purchase_requirement.third_purchase_eans, // List of EANs for third purchase
            excluded_gtins: purchase_requirement.excluded_third_purchase_gtins, // List of excluded GTINs
            excluded_eans: purchase_requirement.excluded_third_purchase_eans, // List of excluded EANs
            prefixed_code: transform_prefixed_code(purchase_requirement.third_purchase_prefixed_code), // Transformed prefixed code
            excluded_prefixed_code: transform_prefixed_code(purchase_requirement.excluded_third_purchase_prefixed_code), // Transformed excluded prefixed code
        },
    }
}

// Function to merge items with the same product_code and price in the basket
function mergeBasketItems(basket) {
    // Create an object to store merged items using a unique key
    let mergedBasket = {};

    // Iterate over each item in the basket
    basket.forEach(item => {
        // Create a unique key by combining product_code and formatted price (to 2 decimal places)
        let key = `${item.product_code}-${item.price.toFixed(2)}`;

        // Check if the item with the same key already exists in the mergedBasket
        if (mergedBasket[key]) {
            // If the item already exists, increase the quantity
            mergedBasket[key].quantity += item.quantity;
        } else {
            // If the item does not exist, add it to the mergedBasket
            mergedBasket[key] = {
                product_code: item.product_code, // Keep the product_code
                price: parseFloat(item.price.toFixed(2)), // Format the price and ensure it's a float
                quantity: item.quantity, // Set initial quantity
                unit: item.unit // Keep the original unit
            };
        }
    });

    // Convert mergedBasket object back to an array and return the result
    return Object.values(mergedBasket);
}

// Function to reorder the subBasket based on the order of product_code in the mainBasket
function reorderSubBasket(mainBasket, subBasket) {
    // Create a map to store the product_code and its corresponding index from the mainBasket
    const orderMap = new Map();
    mainBasket.forEach((item, index) => {
        // Map each product_code to its index for quick lookup
        orderMap.set(item.product_code, index);
    });

    // Sort the subBasket based on the order of product_code in the mainBasket
    subBasket.sort((a, b) => {
        // Compare the indexes of product_code in the orderMap
        // If the product_code is not found in orderMap, assign Infinity to maintain original order for unrecognized items
        return (orderMap.get(a.product_code) ?? Infinity) - (orderMap.get(b.product_code) ?? Infinity);
    });

    // Return the reordered subBasket
    return subBasket;
}

// Function to calculate the total value of items in the basket
function basketValue(basket) {
    // Use the reduce() method to iterate through each item in the basket
    const totalValue = basket.reduce((sum, item) => {
        // For each item, multiply price by quantity and add the value to the running sum
        // Multiply by 100 to convert to cents for precise calculations
        return sum + item.price * item.quantity * 100;
    }, 0);// Initial value of sum is set to 0

    // Return the total value of the basket in cents
    return totalValue;
}

// Main export to expose validate_basket_helper function    
module.exports = {
    validate_basket_helper
}