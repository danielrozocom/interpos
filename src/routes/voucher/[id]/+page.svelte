<script lang="ts">
import { page } from '$app/stores';
import { onMount } from 'svelte';
import { siteName, formatDate } from '../../../lib/config';

let orderId: string;
let transactionDetails: any = null;
let loading = true;
let error = '';

// Utility functions from history page
function cleanNumber(str: string | number): number {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return Number(str.replace(/[^\d.-]/g, ''));
}

function formatCurrency(val: number): string {
  return `$${isNaN(val) ? 0 : Math.round(val).toLocaleString('es-MX')}`;
}

// Smart function to split products string into individual items
function splitProducts(productsStr: string): string[] {
  if (!productsStr || productsStr === '-') return [];
  
  // First try semicolon separator (preferred format)
  if (productsStr.includes(';')) {
    return productsStr
      .split(';')
      .map(p => p.trim())
      .filter(p => p && p !== '-');
  }
  
  // Fallback to comma separator
  if (productsStr.includes(',')) {
    return productsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p && p !== '-');
  }
  
  // If no separators found, return as single item
  return [productsStr.trim()].filter(p => p && p !== '-');
}

// Parse product string to extract name, quantity and price
function parseProduct(productStr: string) {
  let original = productStr.trim();
  
  // Initialize result
  let result = {
    name: '',
    quantity: '1',  // Default to 1
    price: ''
  };
  
  // If string is empty or too short, return as is
  if (!original || original.length < 2) {
    result.name = original;
    return result;
  }
  
  let working = original;
  
  // 1. Extract PRICE: look for $number patterns (including thousands separators)
  const priceMatch = working.match(/\$\s*(\d{1,3}(?:[,\.]\d{3})*(?:\.\d{2})?)/);
  if (priceMatch) {
    // Clean the price: remove thousand separators but keep decimal
    let cleanPrice = priceMatch[1];
    
    // Handle different thousand separator formats
    if (cleanPrice.includes('.') && cleanPrice.includes(',')) {
      // Format like 1.234,56 (European) - convert to 1234.56
      cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
    } else if (cleanPrice.includes(',') && !cleanPrice.includes('.')) {
      // Format like 1,234 (US thousands) - remove commas
      cleanPrice = cleanPrice.replace(/,/g, '');
    } else if (cleanPrice.includes('.') && cleanPrice.lastIndexOf('.') !== cleanPrice.length - 3) {
      // Format like 1.234 (thousands with dot) - remove dots
      cleanPrice = cleanPrice.replace(/\./g, '');
    }
    
    result.price = cleanPrice;
    working = working.replace(priceMatch[0], '').trim();
  }
  
  // 2. Extract QUANTITY: look for xN pattern (case insensitive)
  const quantityMatch = working.match(/\bx(\d+)\b/i);
  if (quantityMatch) {
    result.quantity = quantityMatch[1];
    working = working.replace(quantityMatch[0], '').trim();
  }
  
  // 3. Extract NAME: remove (ID: ...) pattern and clean up separators
  working = working
    .replace(/\(ID:\s*\d+\)/gi, '')         // Remove (ID: number)
    .replace(/\s*-\s*$/, '')                // Remove trailing dash
    .replace(/^\s*-\s*/, '')                // Remove leading dash
    .replace(/\s*;\s*$/, '')                // Remove trailing semicolon
    .replace(/^\s*;\s*/, '')                // Remove leading semicolon
    .replace(/\s*,\s*$/, '')                // Remove trailing comma
    .replace(/^\s*,\s*/, '')                // Remove leading comma
    .replace(/\s+/g, ' ')                   // Multiple spaces to single
    .trim();
  
  // Set the name, fallback to cleaned original if empty
  result.name = working || original.replace(/\(ID:\s*\d+\)/gi, '').replace(/\s*[-;,]\s*$/, '').trim();
  
  // Additional cleaning: if name is still empty or too short, use original
  if (!result.name || result.name.length < 2) {
    result.name = original.split('(ID:')[0].trim();
  }
  
  return result;
}

// Fetch transaction details based on orderId
async function fetchTransactionDetails() {
  loading = true;
  error = '';
  try {
    // Use the existing transactions API with orderID filter
    const res = await fetch(`/api/sheets/transactions?orderID=${orderId}`);
    if (!res.ok) throw new Error('No se pudo obtener las transacciones');
    const response = await res.json();
    
    if (response.success && response.transactions && response.transactions.length > 0) {
      // Get the first matching transaction
      transactionDetails = response.transactions[0];
    } else {
      throw new Error('Transacción no encontrada');
    }
  } catch (e) {
    error = 'Transacción no encontrada o error al consultar los detalles.';
    transactionDetails = null;
  }
  loading = false;
}

onMount(() => {
  orderId = $page.params.id;
  if (orderId) {
    fetchTransactionDetails().then(() => {
      console.log('Transaction Details Received:', transactionDetails); // Log received data
    });
  } else {
    error = 'ID de transacción no proporcionado.';
    loading = false;
  }
});
</script>

<svelte:head>
  <title>Comprobante #{orderId} | {siteName}</title>
  <meta name="description" content="Comprobante de transacción #{orderId}" />
</svelte:head>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap');

  .receipt-container {
    max-width: 420px;
    margin: 10px auto; /* Reducido el margen superior */
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    overflow: hidden;
    border: 1px solid rgba(53, 82, 140, 0.1);
  }

  .receipt-header {
    background: #35528C;
    padding: 20px;
    text-align: center;
    color: white;
    border-bottom: 2px solid rgba(53, 82, 140, 0.2);
    border-radius: 16px 16px 0 0;
  }

  .company-name {
    font-size: 1.8rem;
    font-weight: bold;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .receipt-number {
    font-size: 1rem;
    color: #35528C;
    font-weight: 600;
    background: white;
    padding: 10px 20px;
    border-radius: 12px;
    display: inline-block;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .receipt-body {
    padding: 24px;
    background: #f8f9fa;
    line-height: 1.6;
  }

  .receipt-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(53, 82, 140, 0.1);
  }

  .line-label {
    font-weight: 600;
    color: #35528C;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .line-value {
    font-weight: 500;
    color: #2d3748;
    font-size: 1rem;
    text-align: right;
  }

  .products-section {
    margin: 16px 0;
    padding: 0;
    font-size: 1rem;
    color: #2d3748;
  }

  .products-header {
    font-weight: 700;
    color: #35528C;
    font-size: 1.1rem;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .product-line {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #35528C;
    font-weight: 500;
  }

  .total-section {
    margin-top: 20px;
    padding: 16px;
    text-align: right;
    font-size: 1.5rem;
    font-weight: bold;
    color: #000000;

  }

  .error-receipt {
    text-align: center;
    padding: 60px 20px;
    color: #718096;
    width: 100%;
    word-wrap: break-word;
    font-size: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  @media (max-width: 768px) {
    .receipt-container {
      max-width: 100%;
      margin: 10px;
      border-radius: 8px;
    }

    .receipt-header {
      padding: 16px;
      font-size: 1.2rem;
    }

    .company-name {
      font-size: 1.5rem;
    }

    .receipt-body {
      padding: 16px;
    }

    .receipt-line {
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .line-label {
      font-size: 0.85rem;
    }

    .line-value {
      font-size: 0.95rem;
    }

    .products-header {
      font-size: 1rem;
      margin-bottom: 8px;
    }

    .product-line {
      flex-direction: column;
      align-items: flex-start;
      padding: 4px 0;
    }

    .total-section {
      font-size: 1.2rem;
      padding: 12px;
      text-align: right;
      background-color: transparent;
      border-radius: 0;
      box-shadow: none;
    }
  }
</style>

<div class="min-h-screen  p-6 animate-fadeIn">
  <div class="receipt-container">
    {#if loading}
      <div class="loading-effect" style="background: linear-gradient(90deg, #e0e0e0, #f0f0f0, #e0e0e0); background-size: 200% 100%; animation: shimmer 1.5s infinite; height: 1em; width: 100%;"></div>
    {:else if error}
      <div class="error-receipt">
        <div class="text-4xl mb-4">❌</div>
        <h2 class="text-lg font-bold mb-4">ERROR</h2>
        <p class="text-sm text-red-600">{error}</p>
      </div>
    {:else if transactionDetails}
      <!-- Header del recibo -->
      <div class="receipt-header">
        <div class="company-name">COMPROBANTE</div>
        <div class="receipt-number">ORDEN #{orderId}</div>
      </div>
      
      <!-- Cuerpo del recibo -->
      <div class="receipt-body">
        <div class="receipt-line">
          <span class="line-label">FECHA:</span>
          <span class="line-value">{
            transactionDetails.dateOnly
              ? transactionDetails.dateOnly
              : transactionDetails.date
              ? formatDate(transactionDetails.date)
              : 'Fecha no disponible'
          }</span>
        </div>
        <div class="receipt-line">
          <span class="line-label">HORA:</span>
          <span class="line-value">{
            (() => {
              try {
                console.log('Full transaction details for time processing:', transactionDetails); // Log all details
                
                if (transactionDetails.timeOnly) {
                  console.log('Using timeOnly directly:', transactionDetails.timeOnly);
                  
                  // Simply return the timeOnly value as-is, without any Date object manipulation
                  // This should preserve the original time from the server
                  return transactionDetails.timeOnly;
                }

                console.warn('No timeOnly found in transaction details');
                return 'Hora no disponible';
              } catch (e) {
                console.error('Error processing time:', e);
                return 'Error al procesar la hora';
              }
            })()
          }</span>
        </div>
        
        <div class="receipt-line">
          <span class="line-label">ID CLIENTE:</span>
          <span class="line-value">{transactionDetails.userID}</span>
        </div>
        
        {#if transactionDetails.name}
          <div class="receipt-line">
            <span class="line-label">NOMBRE:</span>
            <span class="line-value">{transactionDetails.name}</span>
          </div>
        {/if}
        
        <div class="receipt-line">
          <span class="line-label">MÉTODO DE PAGO:</span>
          <span class="line-value {transactionDetails.paymentMethod === 'Saldo' ? 'text-blue-600' : 'text-green-600'} font-semibold">
            {transactionDetails.paymentMethod === 'Saldo' ? 'Saldo' : 'Efectivo'}
          </span>
        </div>
        
        <!-- Sección de productos -->
        {#if transactionDetails.products && transactionDetails.products !== '-'}
          <div class="products-section">
            <div class="products-header">PRODUCTOS</div>
            {#each splitProducts(transactionDetails.products) as product, index}
              {@const parsedProduct = parseProduct(product)}
              <div class="product-line">
                <div class="product-name">{parsedProduct.name}</div>
                <div class="product-details">
                  <span>Cant: {parsedProduct.quantity}</span>
                  {#if parsedProduct.price && parsedProduct.price !== '0'}
                    <span>{formatCurrency(cleanNumber(parsedProduct.price))}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Total -->
        <div class="total-section">
          Total: {formatCurrency(cleanNumber(transactionDetails.quantity || 0))}
        </div>
      </div>
    {:else}
      <div class="error-receipt">
        <h2 class="text-lg font-bold mb-4">NO ENCONTRADO</h2>
        <p class="text-sm">No se encontraron detalles para esta transacción.</p>
      </div>
    {/if}
  </div>
</div>
