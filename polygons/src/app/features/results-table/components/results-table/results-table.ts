import { Component, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SearchResult } from '../../../../core/model/search-result';

@Component({
  selector: 'app-results-table',
  imports: [MatTableModule, MatButtonModule, MatIconModule],
  templateUrl: './results-table.html',
  styleUrl: './results-table.scss',
})
export class ResultsTable {
  readonly results = input<SearchResult[]>([]);
  readonly displayedColumns = ['id', 'actions'];
}
