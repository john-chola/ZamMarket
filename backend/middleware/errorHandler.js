exports.errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
  
    // Photo upload errors (multer): too big, wrong type
    if (err.name === 'MulterError') {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Photo is larger than 5 MB. Choose a smaller photo.'
        : `Photo upload error: ${err.message}`;
      return res.status(400).json({ status: 'error', message });
    }
    if (err.message === 'Only JPG, PNG, and WebP images are allowed') {
      return res.status(400).json({ status: 'error', message: err.message });
    }

    // Mongoose duplicate key error (e.g. phone already registered)
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({
        status: 'error',
        message: `This ${field} is already in use.`,
      });
    }
  
    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
      return res.status(400).json({ status: 'error', message: 'Invalid ID format' });
    }
  
    res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };