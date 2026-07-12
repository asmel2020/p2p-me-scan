import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { Order } from '../types';

interface OrdersTableProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
  isLoading: boolean;
}

const typeLabels: Record<string, string> = {
  BUY: 'Buy',
  SELL: 'Sell',
  RENT: 'Rent',
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  placed: 'default',
  accepted: 'default',
  paid: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

const statusLabels: Record<string, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function shorten(val: string, chars = 8): string {
  return `${val.slice(0, chars)}...${val.slice(-4)}`;
}

const columnHelper = createColumnHelper<Order>();

export function OrdersTable({
  orders,
  onOrderClick,
  isLoading,
}: OrdersTableProps) {
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'index',
      header: '#',
      cell: info => (
        <span style={{ color: 'var(--color-muted-foreground)' }}>{info.row.index + 1}</span>
      ),
    }),
    columnHelper.accessor('orderId', {
      header: 'Order ID',
      cell: info => (
        <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 500, fontSize: '0.75rem' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('orderType', {
      header: 'Type',
      cell: info => <span>{typeLabels[info.getValue()] || info.getValue()}</span>,
    }),
    columnHelper.accessor('usdc', {
      header: 'USDC',
      cell: info => <span style={{ fontWeight: 600 }}>{info.getValue().toLocaleString()}</span>,
    }),
    columnHelper.accessor(row => `${row.fiat.toLocaleString()} ${row.currency}`, {
      id: 'fiat',
      header: 'Fiat',
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const status = info.getValue();
        return (
          <Badge variant={statusVariant[status] || 'default'}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('user', {
      header: 'User',
      cell: info => (
        <span style={{ fontFamily: 'monospace', color: 'var(--color-muted-foreground)' }}>
          {shorten(info.getValue(), 6)}
        </span>
      ),
    }),
    columnHelper.accessor('createdBlock', {
      header: 'Block',
      cell: info => (
        <span style={{ fontFamily: 'monospace', color: 'var(--color-muted-foreground)' }}>
          #{info.getValue()}
        </span>
      ),
    }),
  ], []);

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted-foreground)' }}>
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted-foreground)' }}>
        No orders found
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              className="table-row-hover"
              onClick={() => onOrderClick(row.original)}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
