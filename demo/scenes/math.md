Why does cross-entropy suit a softmax output?
---
For one example with true class $y$ and predicted probabilities $p_i$, the loss is

$$
\mathcal{L} = -\sum_{i=1}^{K} y_i \log p_i, \qquad p_i = \frac{e^{z_i}}{\sum_{j=1}^{K} e^{z_j}}
$$

Its gradient with respect to the logits is the error itself, $\partial \mathcal{L} / \partial z_i = p_i - y_i$,
so it never vanishes while the model is wrong:

$$
\frac{\partial \mathcal{L}}{\partial z} = \underbrace{p - y}_{\text{prediction minus truth}}
\qquad
z \xrightarrow{\ \operatorname{softmax}\ } p \xrightarrow{-\log} \mathcal{L}
$$

With squared error the same gradient carries a factor $p_i(1 - p_i)$, which is near zero when
$p_i \to 0$ or $p_i \to 1$:

$$
\nabla_z \tfrac12 \lVert p - y \rVert^2 = J^\top (p - y), \quad
J_{ij} = \begin{cases} p_i (1 - p_i) & i = j \\ -p_i p_j & i \ne j \end{cases}
$$
