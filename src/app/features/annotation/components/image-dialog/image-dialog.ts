import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { NewPolygon, PolygonChange } from '../../models/editor';
import { ImageDialogData } from '../../models/image-dialog-data';
import { PolygonsActions } from '../../state/polygons.actions';
import { selectPolygonsForImage } from '../../state/polygons.reducer';
import { PolygonEditor } from './polygon-editor/polygon-editor';

@Component({
  selector: 'app-image-dialog',
  imports: [
    DatePipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIconButton,
    MatIcon,
    PolygonEditor,
  ],
  templateUrl: './image-dialog.html',
  styleUrl: './image-dialog.scss',
})
export class ImageDialog {
  private readonly store = inject(Store);
  private readonly dialogRef = inject<MatDialogRef<ImageDialog>>(MatDialogRef);
  protected readonly image = inject<ImageDialogData>(MAT_DIALOG_DATA).image;

  protected readonly polygons = this.store.selectSignal(selectPolygonsForImage(this.image.nasaId));

  private readonly editor = viewChild.required(PolygonEditor);

  constructor() {
    const document = inject(DOCUMENT);
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.editor().handleEscape()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeydown, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('keydown', onKeydown, { capture: true }),
    );
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected onCreated(polygon: NewPolygon): void {
    this.store.dispatch(
      PolygonsActions.polygonAdded({ polygon: { ...polygon, imageId: this.image.nasaId } }),
    );
  }

  protected onChanged({ id, points }: PolygonChange): void {
    this.store.dispatch(PolygonsActions.polygonChanged({ id, points }));
  }

  protected onDeleted(id: string): void {
    this.store.dispatch(PolygonsActions.polygonRemoved({ id }));
  }

  protected onCleared(): void {
    this.store.dispatch(PolygonsActions.imagePolygonsCleared({ imageId: this.image.nasaId }));
  }
}
