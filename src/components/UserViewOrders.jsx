import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserViewOrders.css';
import { Filter } from 'bad-words';

const StarRating = ({ rating, setRating }) => {
  const handleStarClick = (index) => {
    setRating(index + 1);
  };

  return (
    <div className="star-rating">
      {[...Array(5)].map((_, index) => (
        <span
          key={index}
          className={index < rating ? 'star filled' : 'star'}
          onClick={() => handleStarClick(index)}
        >
          ★
        </span>
      ))}
    </div>
  );
};

const UserViewOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [review, setReview] = useState({ rating: 0, description: '', image: null, productId: '', reviewId: null });
  const [imagePreview, setImagePreview] = useState(null);

  const filter = new Filter();
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      if (!token) {
        setError('You are not logged in. Please log in to view your orders.');
        setLoading(false);
        return;
      }

      const response = await axios.get('http://localhost:5001/api/auth/view/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setOrders(response.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Error fetching orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);
  const handleReviewSubmit = async () => {
    const cleanDescription = filter.clean(review.description);
    const token = localStorage.getItem('auth-token');
    
    try {
      const formData = new FormData();
      formData.append('productId', review.productId);
      formData.append('rating', review.rating);
      formData.append('description', cleanDescription);
      
      // Append the image to the FormData if it exists
      if (review.image) {
        formData.append('image', review.image);  // 'image' is the key for the file in the FormData
      }
  
      // Determine the endpoint for submitting or updating the review
      const endpoint = review.reviewId
        ? `http://localhost:5001/api/auth/update-review/${review.reviewId}`
        : 'http://localhost:5001/api/auth/submit-review';
      
      // Send the review data to the backend
      const method = review.reviewId ? axios.put : axios.post;
      
      await method(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data', // Ensure the correct content type is set
        },
      });
      
      // Close the modal and refresh orders after submission
      setModalVisible(false);
      fetchOrders();  // Refresh the orders after submitting the review
    } catch (error) {
      // Handle any errors that occur during the submission process
      console.error('Error submitting review:', error);
      alert(`Error: ${error.response?.data?.message || error.response?.statusText || 'Please try again later.'}`);
    }
  };
  
  

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setReview({ ...review, image: file });
    setImagePreview(URL.createObjectURL(file));
  };

  const openReviewModal = (order, product) => {
    setSelectedOrder(order);
    setReview({
      rating: 0,
      description: '',
      image: null,
      productId: product._id,
      reviewId: null,
    });

    setImagePreview(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setReview({ rating: 0, description: '', image: null, productId: '', reviewId: null });
    setImagePreview(null);
  };

  const formatAddress = (order) => {
    const { street, city, state, postalCode, country } = order.shippedToAddress;
  
    return (
      <div className="address-container">
        <p>{street}, {city}, {state}, {postalCode}, {country}</p>
        {isAddressExpanded && (
          <p>{country}</p>
        )}
      </div>
    );
  };

  const markAsDelivered = async (orderId) => {
    const token = localStorage.getItem('auth-token');
    try {
        // Make the PATCH request to mark the order as delivered
        const response = await axios.patch(
            `http://localhost:5001/api/auth/mark-delivered/${orderId}`,
            {}, 
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        // Handle the response after marking as delivered
        if (response.status === 200) {
            console.log('Order marked as delivered:', response.data);
            fetchOrders(); // Refresh the orders after marking as delivered
            alert('Order has been successfully marked as delivered!');
        }
    } catch (err) {
        console.error('Error marking order as delivered:', err);
        // Show a more specific error message from the backend if available
        alert(`Error: ${err.response?.data?.message || 'Please try again later.'}`);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="orders-container">
      <h1>My Orders</h1>
      {orders.length === 0 ? (
        <p>You haven't made any orders yet.</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Order Status</th>
              <th>Total</th>
              <th>Created At</th>
              <th>Shipping Address</th>
              <th>Products</th>
              <th>Payment Method</th>
              <th>Shipping Method</th>
              <th>Shipping Status</th>
              <th>Actions</th>
              <th>Mark as Delivered</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td>{order._id}</td>
                <td>{order.orderStatus}</td>
                <td>${order.totalPrice.toFixed(2)}</td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                <td>{formatAddress(order)}</td>
                <td>
                  <ul>
                    {order.products.map((item) => (
                      <li key={item.product._id}>
                        {item.product.name} (x{item.quantity})
                      </li>
                    ))}
                  </ul>
                </td>
                <td>{order.paymentMethod}</td>
                <td>{order.shippingMethod}</td>
                <td>{order.shippingStatus}</td>
                <td>
                  {order.orderStatus === 'Accepted' && (
                    order.products.map((item) => (
                      !item.reviewExists ? (
                        <button
                          key={item.product._id}
                          className="review-button"
                          onClick={() => openReviewModal(order, item.product)}
                        >
                          Submit a Review for {item.product.name}
                        </button>
                      ) : (
                        <span key={item.product._id}>Review Already Submitted</span>
                      )
                    ))
                  )}
                </td>
                <td>
                  {order.shippingStatus === 'Delivered' ? (
                    <span>Already Delivered</span>  // Message when already delivered
                  ) : (
                    order.orderStatus === 'Accepted' && (
                      <button
                        className="mark-delivered-button"
                        onClick={() => markAsDelivered(order._id)}
                      >
                        Mark as Delivered
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalVisible && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Submit a Review for {selectedOrder && selectedOrder.products.find(p => p.product._id === review.productId)?.product.name}</h2>
            <form onSubmit={(e) => e.preventDefault()}>
              <label>Rating:</label>
              <StarRating rating={review.rating} setRating={(value) => setReview({ ...review, rating: value })} />
              <label>Description:</label>
              <textarea
                value={review.description}
                onChange={(e) => setReview({ ...review, description: e.target.value })}
                required
              />
              <label>Upload Image (optional):</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && <img src={imagePreview} alt="Preview" className="image-preview" />}
              <div className="modal-actions">
                <button type="button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" onClick={handleReviewSubmit}>
                  {review.reviewId ? 'Update Review' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserViewOrders;
