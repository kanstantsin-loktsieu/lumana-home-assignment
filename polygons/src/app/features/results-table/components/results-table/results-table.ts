import { Component, inject, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SearchResult } from '../../../../core/model/search-result';
import { ImageDialog } from '../../../image-dialog/components/image-dialog/image-dialog';

@Component({
  selector: 'app-results-table',
  imports: [MatTableModule, MatButtonModule, MatIconModule],
  templateUrl: './results-table.html',
  styleUrl: './results-table.scss',
})
export class ResultsTable {
  private readonly dialog = inject(MatDialog);

  readonly results = input<SearchResult[]>([]);
  readonly displayedColumns = ['id', 'tags', 'actions'];

  onRowClick(row: SearchResult): void {
    this.dialog.open(ImageDialog, {
      data: row
    });
  }
}
