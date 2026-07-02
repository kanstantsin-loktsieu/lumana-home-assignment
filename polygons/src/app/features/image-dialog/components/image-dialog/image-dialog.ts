import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SearchResult } from '../../../../core/model/search-result';
import { NgOptimizedImage } from '@angular/common';
import { PolygonCanvas } from '../../../polygon-drawing/directives/polygon-canvas';

@Component({
  selector: 'app-image-dialog',
  imports: [NgOptimizedImage, PolygonCanvas],
  templateUrl: './image-dialog.html',
  styleUrl: './image-dialog.scss',
})
export class ImageDialog {
  readonly data = inject<SearchResult>(MAT_DIALOG_DATA);
}
