import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatToolbar } from '@angular/material/toolbar';
import { SearchPage } from './features/search/components/search-page/search-page';

@Component({
  selector: 'app-root',
  imports: [MatToolbar, MatIcon, SearchPage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
