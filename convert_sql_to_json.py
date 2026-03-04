
import re
import json

def parse_sql_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    data = {
        "branches": {},
        "products": {},
        "users": {},
        "orders": {},
        "inventory": {},
        "categories": {}
    }

    # Helper to parse INSERT statements
    def parse_table_inserts(table_name, columns):
        # Regex to find INSERT INTO `table` (...) VALUES ...
        # Handling multiple values groups
        pattern = re.compile(f"INSERT INTO `{table_name}` \((.*?)\) VALUES\s*(.*?;)", re.DOTALL)
        match = pattern.search(content)
        if not match:
            return []
        
        # cols_str = match.group(1) # columns identified in regex, but we might just use the passed columns list if we trust order, 
        # but better to parse columns from SQL to be safe.
        cols_found = [c.strip().strip('`') for c in match.group(1).split(',')]
        
        values_str = match.group(2).strip().rstrip(';')
        
        # Split by ), ( to get individual rows. 
        # This is a simple parser, might be fragile with complex strings, but standard dumps are usually consistent.
        # Replacing '),\n(' with ')|(' to split easier?
        # A better way for values:
        rows = []
        current_row = ""
        in_string = False
        escape = False
        
        # Basic state machine to split rows
        row_buffer = []
        
        # Normalize the string first meant for regex splitting
        # Or just use the fact that it's standard MySQL dump
        # (1, 'val'), (2, 'val')
        
        rows_raw = re.split(r'\),\s*\(', values_str)
        
        cleaned_rows = []
        for r in rows_raw:
            r = r.strip().lstrip('(').rstrip(')')
            # naive CSV split will fail on commas in strings.
            # Using a custom splitter handling quotes
            values = []
            curr_val = []
            in_q = False
            esc = False
            for char in r:
                if esc:
                    curr_val.append(char)
                    esc = False
                elif char == '\\':
                    esc = True
                elif char == "'" and not esc:
                    in_q = not in_q
                elif char == ',' and not in_q:
                    values.append("".join(curr_val).strip())
                    curr_val = []
                else:
                    curr_val.append(char)
            values.append("".join(curr_val).strip())
            
            # Clean quotes around values
            clean_vals = []
            for v in values:
                if v.startswith("'") and v.endswith("'"):
                    v = v[1:-1]
                elif v.lower() == 'null':
                    v = None
                else:
                    # Try number
                    try:
                        if '.' in v:
                            v = float(v)
                        else:
                            v = int(v)
                    except:
                        pass
                clean_vals.append(v)
            
            row_dict = dict(zip(cols_found, clean_vals))
            cleaned_rows.append(row_dict)
            
        return cleaned_rows

    # Parse Tables
    branches_rows = parse_table_inserts('branches', [])
    for row in branches_rows:
        data['branches'][str(row['id'])] = row

    products_rows = parse_table_inserts('products', [])
    for row in products_rows:
        data['products'][str(row['id'])] = row
        # Initialize stock to 0, will update from inventory
        data['products'][str(row['id'])]['stock'] = 0

    users_rows = parse_table_inserts('users', [])
    for row in users_rows:
        # Remove password as it is bcrypt and useless for frontend checking without auth system linking
        # But keeping it might be confusing. Let's keep data as is, but maybe add a note field?
        # Actually, for Firebase Auth migration, we can't import these passwords easily.
        data['users'][str(row['id'])] = row

    inventory_rows = parse_table_inserts('inventory', [])
    for row in inventory_rows:
        # Add to global inventory node
        data['inventory'][str(row['id'])] = row
        
        # Aggregate stock to product
        p_id = str(row['product_id'])
        if p_id in data['products']:
             qty = row['quantity']
             if qty:
                 data['products'][p_id]['stock'] = data['products'][p_id].get('stock', 0) + int(qty)

    orders_rows = parse_table_inserts('orders', [])
    order_items_rows = parse_table_inserts('order_items', [])
    
    # Map items to orders
    items_by_order = {}
    for item in order_items_rows:
        o_id = str(item['order_id'])
        if o_id not in items_by_order:
            items_by_order[o_id] = []
        items_by_order[o_id].append(item)
        
    for row in orders_rows:
        o_id = str(row['id'])
        row['items'] = items_by_order.get(o_id, [])
        data['orders'][o_id] = row

    return data

# Run
imported_data = parse_sql_file('medico_saas (1).sql')

with open('firebase_import.json', 'w', encoding='utf-8') as f:
    json.dump(imported_data, f, indent=4)

print("JSON generation complete: firebase_import.json")
