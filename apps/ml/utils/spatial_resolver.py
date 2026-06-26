import numpy as np
from sklearn.cluster import DBSCAN

class SpatialLayoutResolver:
    def __init__(self, row_overlap_epsilon=0.3, min_column_samples=1):
        """
        Args:
            row_overlap_epsilon (float): Percentage of vertical overlap allowed to group tokens into a single row.
            min_column_samples (int): Minimum points to form a column cluster via DBSCAN.
        """
        self.row_overlap_epsilon = row_overlap_epsilon
        self.min_column_samples = min_column_samples

    def resolve_layout(self, ocr_tokens):
        """
        Args:
            ocr_tokens (list): List of dicts representing raw OCR outputs:
                               [{"text": "Amlodipine", "bbox": [xmin, ymin, xmax, ymax]}, ...]
        Returns:
            str: A structured Markdown table representing the logical 2D layout.
        """
        if not ocr_tokens:
            return ""

        # 1. Extrapolate coordinates into a structured NumPy Matrix
        bboxes = np.array([t["bbox"] for t in ocr_tokens], dtype=np.float32)
        texts = np.array([t["text"] for t in ocr_tokens])

        # 2. Step 1: Horizontal Projection Profiling / Row Segmentation
        y_sort_indices = np.argsort(bboxes[:, 1])
        bboxes = bboxes[y_sort_indices]
        texts = texts[y_sort_indices]

        rows = []
        current_row_indices = []
        
        for i in range(len(bboxes)):
            if not current_row_indices:
                current_row_indices.append(i)
                continue
            
            current_ymin = np.min(bboxes[current_row_indices, 1])
            current_ymax = np.max(bboxes[current_row_indices, 3])
            current_height = current_ymax - current_ymin
            
            token_ymin = bboxes[i, 1]
            token_ymax = bboxes[i, 3]
            
            overlap = min(current_ymax, token_ymax) - max(current_ymin, token_ymin)
            
            if overlap > (current_height * self.row_overlap_epsilon) or token_ymin <= current_ymax:
                current_row_indices.append(i)
            else:
                rows.append(current_row_indices)
                current_row_indices = [i]
        if current_row_indices:
            rows.append(current_row_indices)

        # 3. Step 2 & 3: Column Identification (DBSCAN) & Grid Reconstruction
        markdown_lines = []
        
        for row_idx in rows:
            row_bboxes = bboxes[row_idx]
            row_texts = texts[row_idx]
            
            x_features = row_bboxes[:, 0].reshape(-1, 1)
            
            widths = row_bboxes[:, 2] - row_bboxes[:, 0]
            median_width = np.median(widths) if len(widths) > 0 else 10
            adaptive_eps = median_width * 1.5 

            clustering = DBSCAN(eps=adaptive_eps, min_samples=self.min_column_samples).fit(x_features)
            labels = clustering.labels_
            
            unique_labels = np.unique(labels)
            column_groups = []
            
            for label in unique_labels:
                label_indices = np.where(labels == label)[0]
                sub_sort = np.argsort(row_bboxes[label_indices, 0])
                sorted_label_indices = label_indices[sub_sort]
                
                mean_x = np.mean(row_bboxes[sorted_label_indices, 0])
                combined_text = " ".join(row_texts[sorted_label_indices])
                column_groups.append((mean_x, combined_text))
            
            column_groups.sort(key=lambda item: item[0])
            
            row_string = "| " + " | ".join([text for _, text in column_groups]) + " |"
            markdown_lines.append(row_string)

        return "\n".join(markdown_lines)

if __name__ == "__main__":
    print("🚀 Initializing Test Execution Pipeline...")
    
    mock_ocr_payload = [
        {"text": "Amlodipine 5mg", "bbox": [10, 100, 150, 130]},      
        {"text": "Take 1 tab at night", "bbox": [400, 105, 600, 135]},  
        
        {"text": "Paracetamol 650mg", "bbox": [12, 200, 160, 230]},    
        {"text": "S.O.S if fever high", "bbox": [405, 195, 590, 225]}, 
    ]
    
    resolver = SpatialLayoutResolver()
    structured_output = resolver.resolve_layout(mock_ocr_payload)
    
    print("\n--- RECONSTRUCTED MATRIX OUTPUT ---")
    print(structured_output)
    print("-----------------------------------\n")