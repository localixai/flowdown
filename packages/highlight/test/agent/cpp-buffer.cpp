#include <algorithm>
#include <cstdint>
#include <stdexcept>
#include <vector>
#include "buffer.h"

namespace acme {

// A ring buffer of a fixed capacity.
template <typename T>
class RingBuffer {
 public:
  explicit RingBuffer(std::size_t capacity) : data_(capacity), head_(0), size_(0) {
    if (capacity == 0) throw std::invalid_argument("capacity must be positive");
  }

  void push(const T& value) {
    data_[(head_ + size_) % data_.size()] = value;
    if (size_ < data_.size()) {
      ++size_;
    } else {
      head_ = (head_ + 1) % data_.size();
    }
  }

  [[nodiscard]] std::size_t size() const noexcept { return size_; }

  T& operator[](std::size_t index) { return data_.at((head_ + index) % data_.size()); }

 private:
  std::vector<T> data_;
  std::size_t head_;
  std::size_t size_;
};

}  // namespace acme

int main() {
  acme::RingBuffer<int> buffer(3);
  for (int i = 0; i < 5; ++i) buffer.push(i * 2);
  auto max = std::max({buffer[0], buffer[1], buffer[2]});
  return max == 8 ? 0 : 1;
}
