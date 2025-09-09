import React from 'react';
import {
  Box,
  Typography,
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Paper,
  Alert
} from '@mui/material';

const TagSelection = ({ tags, selectedTags, onTagsChange }) => {
  const handleTagToggle = (tagName) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(tag => tag !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  };

  if (!tags || tags.length === 0) {
    return (
      <Alert severity="info">
        No tags available. All machines will be shown in the next step.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Filter machines by tags
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select tags to filter machines. Leave empty to show all machines.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Selected Tags ({selectedTags.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedTags.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tags selected - all machines will be shown
            </Typography>
          ) : (
            selectedTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => handleTagToggle(tag)}
                color="primary"
              />
            ))
          )}
        </Box>
      </Paper>

      <Typography variant="subtitle1" gutterBottom>
        Available Tags
      </Typography>
      <FormGroup>
        {tags.map(tag => (
          <FormControlLabel
            key={tag.name}
            control={
              <Checkbox
                checked={selectedTags.includes(tag.name)}
                onChange={() => handleTagToggle(tag.name)}
              />
            }
            label={
              <Box>
                <Typography variant="body1">{tag.name}</Typography>
                {tag.comment && (
                  <Typography variant="body2" color="text.secondary">
                    {tag.comment}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {tag.machine_count || 0} machines
                </Typography>
              </Box>
            }
          />
        ))}
      </FormGroup>
    </Box>
  );
};

export default TagSelection;